import { PrismaClient, ActivityType, Category } from '@prisma/client'
import bcrypt from 'bcryptjs'
import citiesData from './data/cities.json'
import activitiesData from './data/activities.json'

const db = new PrismaClient()

function utcDay(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

async function seedCatalogue() {
  for (const c of citiesData) {
    await db.city.upsert({
      where: { name_country: { name: c.name, country: c.country } },
      update: {
        region: c.region,
        costIndex: c.costIndex,
        popularity: c.popularity,
        imageUrl: c.imageUrl,
        lat: c.lat,
        lng: c.lng,
      },
      create: {
        name: c.name,
        country: c.country,
        region: c.region,
        costIndex: c.costIndex,
        popularity: c.popularity,
        imageUrl: c.imageUrl,
        lat: c.lat,
        lng: c.lng,
      },
    })
  }

  const cityRows = await db.city.findMany({ select: { id: true, name: true, country: true } })
  const cityIdByKey = new Map(cityRows.map((c) => [`${c.name}|${c.country}`, c.id]))

  // Idempotent re-seed: clear and recreate activities every run (they're catalogue data, not user data).
  await db.activity.deleteMany({})
  for (const a of activitiesData) {
    const cityId = cityIdByKey.get(`${a.city}|${a.country}`)
    if (!cityId) {
      console.warn(`No matching city for activity "${a.name}" (${a.city}, ${a.country})`)
      continue
    }
    await db.activity.create({
      data: {
        cityId,
        name: a.name,
        type: a.type as ActivityType,
        description: a.description,
        avgCost: a.avgCost,
        durationMin: a.durationMin,
        imageUrl: a.imageUrl,
        rating: a.rating,
      },
    })
  }

  return { cityIdByKey }
}

async function seedUsers() {
  const demoPassword = await bcrypt.hash('demo1234', 10)
  const adminPassword = await bcrypt.hash('admin1234', 10)

  const demo = await db.user.upsert({
    where: { email: 'demo@globetrotter.app' },
    update: {},
    create: {
      email: 'demo@globetrotter.app',
      password: demoPassword,
      firstName: 'Demo',
      lastName: 'Traveller',
      city: 'Mumbai',
      country: 'India',
      language: 'en',
      bio: 'Chasing shoulder-season flights and street food across Southeast Asia.',
    },
  })

  const admin = await db.user.upsert({
    where: { email: 'admin@globetrotter.app' },
    update: { isAdmin: true },
    create: {
      email: 'admin@globetrotter.app',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      city: 'Bengaluru',
      country: 'India',
      language: 'en',
      isAdmin: true,
    },
  })

  const extraSpecs = [
    { firstName: 'Aisha', lastName: 'Khan', country: 'UAE', city: 'Dubai' },
    { firstName: 'Marco', lastName: 'Rossi', country: 'Italy', city: 'Rome' },
    { firstName: 'Yuki', lastName: 'Tanaka', country: 'Japan', city: 'Tokyo' },
    { firstName: 'Sofia', lastName: 'Silva', country: 'Portugal', city: 'Lisbon' },
    { firstName: 'Liam', lastName: 'Clarke', country: 'Australia', city: 'Sydney' },
    { firstName: 'Priya', lastName: 'Nair', country: 'India', city: 'Kochi' },
  ]

  const extras = []
  for (const spec of extraSpecs) {
    const email = `${spec.firstName.toLowerCase()}.${spec.lastName.toLowerCase()}@globetrotter.app`
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: demoPassword,
        firstName: spec.firstName,
        lastName: spec.lastName,
        city: spec.city,
        country: spec.country,
        language: 'en',
      },
    })
    extras.push(user)
  }

  return { demo, admin, extras }
}

interface StopPlan {
  cityKey: string
  startOffset: number
  endOffset: number
  notes: string
  activities: { name: string; dayIndex: number; startTime: string }[]
}

async function buildTripTree(
  userId: string,
  name: string,
  description: string,
  tripStart: Date,
  totalDays: number,
  stopPlans: StopPlan[],
  cityIdByKey: Map<string, string>,
  activityByCityAndName: Map<string, { id: string; avgCost: number }>,
  opts: { isPublic?: boolean; budgetCap?: number; extraExpenses?: { category: Category; label: string; amount: number; dayIndex: number | null; stopIndex: number | null }[] } = {}
) {
  const tripEnd = addDays(tripStart, totalDays - 1)

  const trip = await db.trip.create({
    data: {
      userId,
      name,
      description,
      startDate: tripStart,
      endDate: tripEnd,
      currency: 'INR',
      isPublic: opts.isPublic ?? false,
      budgetCap: opts.budgetCap,
    },
    select: { id: true },
  })

  const stopIds: string[] = []

  for (let i = 0; i < stopPlans.length; i++) {
    const plan = stopPlans[i]
    const cityId = cityIdByKey.get(plan.cityKey)
    if (!cityId) throw new Error(`Missing city for key ${plan.cityKey}`)

    const stop = await db.stop.create({
      data: {
        tripId: trip.id,
        cityId,
        startDate: addDays(tripStart, plan.startOffset),
        endDate: addDays(tripStart, plan.endOffset),
        order: i,
        notes: plan.notes,
      },
      select: { id: true },
    })
    stopIds.push(stop.id)

    let order = 0
    for (const item of plan.activities) {
      const activity = activityByCityAndName.get(`${plan.cityKey}|${item.name}`)
      if (!activity) {
        console.warn(`Missing activity "${item.name}" for ${plan.cityKey}`)
        continue
      }
      await db.tripActivity.create({
        data: {
          stopId: stop.id,
          activityId: activity.id,
          dayIndex: item.dayIndex,
          startTime: item.startTime,
          cost: activity.avgCost,
          order: order++,
        },
      })
    }
  }

  for (const exp of opts.extraExpenses ?? []) {
    await db.expense.create({
      data: {
        tripId: trip.id,
        stopId: exp.stopIndex !== null ? stopIds[exp.stopIndex] : null,
        category: exp.category,
        label: exp.label,
        amount: exp.amount,
        dayIndex: exp.dayIndex,
      },
    })
  }

  return trip.id
}

async function seedTrips(
  demoId: string,
  extras: { id: string }[],
  cityIdByKey: Map<string, string>
) {
  const activityRows = await db.activity.findMany({
    include: { city: { select: { name: true, country: true } } },
  })
  // Keyed as "CityName|Country|ActivityName" — cityKey (from StopPlan) already encodes "Name|Country".
  const lookup = new Map<string, { id: string; avgCost: number }>()
  for (const a of activityRows) {
    lookup.set(`${a.city.name}|${a.city.country}|${a.name}`, { id: a.id, avgCost: Number(a.avgCost) })
  }

  // Clear any prior demo trips so re-seeding is idempotent.
  await db.trip.deleteMany({ where: { userId: demoId } })

  const today = utcDay(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth() + 1,
    new Date().getUTCDate()
  )

  // --- The hero trip: "14 Days Across Southeast Asia" (Bangkok -> Chiang Mai -> Hanoi -> Bali) ---
  // Started 3 days ago so it renders ONGOING whenever the seed runs.
  const heroStart = addDays(today, -3)

  const heroStopPlans: StopPlan[] = [
    {
      cityKey: 'Bangkok|Thailand',
      startOffset: 0,
      endOffset: 3,
      notes: 'Arrival city — temples, street food and the river.',
      activities: [
        { name: 'Long-tail boat tour of Thonburi khlongs', dayIndex: 0, startTime: '09:00' },
        { name: 'Grand Palace and Wat Phra Kaew tour', dayIndex: 1, startTime: '09:30' },
        { name: 'Yaowarat night market street-food crawl', dayIndex: 1, startTime: '19:00' },
        { name: 'Chatuchak Weekend Market treasure hunt', dayIndex: 2, startTime: '10:00' },
        { name: 'Rooftop bar hop above Silom', dayIndex: 3, startTime: '18:30' },
      ],
    },
    {
      cityKey: 'Chiang Mai|Thailand',
      startOffset: 4,
      endOffset: 7,
      notes: 'Mountain town — elephants, temples and a paragliding morning.',
      activities: [
        { name: 'Doi Suthep sunrise viewpoint hike', dayIndex: 4, startTime: '05:30' },
        { name: 'Elephant Nature Park ethical sanctuary visit', dayIndex: 5, startTime: '08:00' },
        { name: 'Paragliding over Doi Suthep foothills', dayIndex: 6, startTime: '07:00' },
        { name: 'Khao soi cooking class in a teak house', dayIndex: 6, startTime: '17:00' },
        { name: 'Sunday Walking Street night market', dayIndex: 7, startTime: '18:00' },
      ],
    },
    {
      cityKey: 'Hanoi|Vietnam',
      startOffset: 8,
      endOffset: 10,
      notes: 'Old Quarter chaos, a Ha Long Bay day trip.',
      activities: [
        { name: 'Old Quarter street-food walking tour', dayIndex: 8, startTime: '18:00' },
        { name: 'Ha Long Bay day cruise from Hanoi', dayIndex: 9, startTime: '07:00' },
        { name: 'Water puppet show at Thang Long theatre', dayIndex: 10, startTime: '16:00' },
      ],
    },
    {
      cityKey: 'Bali|Indonesia',
      startOffset: 11,
      endOffset: 13,
      notes: 'Rice terraces, a sunrise volcano trek and the beach club send-off.',
      activities: [
        { name: 'Tegallalang rice terrace walk', dayIndex: 11, startTime: '09:00' },
        { name: 'Mount Batur sunrise trek', dayIndex: 12, startTime: '03:30' },
        { name: 'Balinese cooking class with market visit', dayIndex: 12, startTime: '16:00' },
        { name: 'Seminyak beach club sunset session', dayIndex: 13, startTime: '17:00' },
      ],
    },
  ]

  // budgetCap tuned (see simulation in project notes) so exactly one day — day 6, the
  // Chiang Mai paragliding + cooking-class day — breaches the daily cap of 8350.
  const heroTripId = await buildTripTree(
    demoId,
    '14 Days Across Southeast Asia',
    'Bangkok, Chiang Mai, Hanoi and Bali — temples, a paragliding morning, and one very good beach club.',
    heroStart,
    14,
    heroStopPlans,
    cityIdByKey,
    lookup,
    {
      isPublic: true,
      budgetCap: 8350 * 14,
      extraExpenses: [
        { category: 'STAY', label: 'Bangkok hotel (4 nights)', amount: 4000, dayIndex: null, stopIndex: 0 },
        { category: 'STAY', label: 'Chiang Mai guesthouse (4 nights)', amount: 4000, dayIndex: null, stopIndex: 1 },
        { category: 'STAY', label: 'Hanoi hotel (3 nights)', amount: 3000, dayIndex: null, stopIndex: 2 },
        { category: 'STAY', label: 'Bali villa (3 nights)', amount: 4500, dayIndex: null, stopIndex: 3 },
        { category: 'TRANSPORT', label: 'Flights: Bangkok-Chiang Mai-Hanoi-Bali (3 legs)', amount: 20500, dayIndex: null, stopIndex: null },
        { category: 'MEAL', label: 'Ha Long Bay cruise lunch and dinner included', amount: 1800, dayIndex: 9, stopIndex: null },
        { category: 'OTHER', label: 'Travel insurance', amount: 2200, dayIndex: null, stopIndex: null },
      ],
    }
  )
  await db.trip.update({ where: { id: heroTripId }, data: { shareSlug: 'sea-loop-demo1' } })

  // --- A second, upcoming trip for the demo account ---
  await buildTripTree(
    demoId,
    'Long Weekend in Dubai',
    'A short desert-and-skyline trip.',
    addDays(today, 20),
    4,
    [
      {
        cityKey: 'Dubai|United Arab Emirates',
        startOffset: 0,
        endOffset: 3,
        notes: 'Skyline, souks and a desert evening.',
        activities: [
          { name: 'Burj Khalifa At the Top observation deck', dayIndex: 0, startTime: '17:00' },
          { name: 'Desert safari with dune bashing and BBQ', dayIndex: 1, startTime: '15:00' },
          { name: 'Dubai Gold and Spice Souk walk', dayIndex: 2, startTime: '11:00' },
        ],
      },
    ],
    cityIdByKey,
    lookup
  )

  // --- A completed trip for the demo account (so My Trips shows all three groups) ---
  await buildTripTree(
    demoId,
    'Weekend in Kyoto',
    'A quick temple-and-noodles trip from last season.',
    addDays(today, -40),
    3,
    [
      {
        cityKey: 'Kyoto|Japan',
        startOffset: 0,
        endOffset: 2,
        notes: 'Temples, bamboo, and a kaiseki dinner.',
        activities: [
          { name: 'Fushimi Inari thousand torii gate hike', dayIndex: 0, startTime: '08:00' },
          { name: 'Arashiyama bamboo grove and monkey park', dayIndex: 1, startTime: '09:00' },
          { name: 'Kyoto kaiseki multi-course dinner', dayIndex: 2, startTime: '19:00' },
        ],
      },
    ],
    cityIdByKey,
    lookup
  )

  // --- 1-3 public trips each for the extra users ---
  const extraTripSpecs: { cityKey: string; name: string }[] = [
    { cityKey: 'Paris|France', name: 'Long Weekend in Paris' },
    { cityKey: 'Rome|Italy', name: 'Roman Holiday' },
    { cityKey: 'Tokyo|Japan', name: 'Tokyo in Five Days' },
    { cityKey: 'Lisbon|Portugal', name: 'Lisbon and the Coast' },
    { cityKey: 'Sydney|Australia', name: 'Sydney Summer Loop' },
    { cityKey: 'Kochi|India', name: 'Backwaters and Spice' },
  ]

  for (let i = 0; i < extras.length; i++) {
    const spec = extraTripSpecs[i]
    const cityActivities = activityRows.filter((a) => `${a.city.name}|${a.city.country}` === spec.cityKey)
    const picks = cityActivities.slice(0, 3)

    await buildTripTree(
      extras[i].id,
      spec.name,
      `A short trip built around ${spec.cityKey.split('|')[0]}.`,
      addDays(today, 10 + i * 5),
      3,
      [
        {
          cityKey: spec.cityKey,
          startOffset: 0,
          endOffset: 2,
          notes: 'A short, focused city stop.',
          activities: picks.map((a, idx) => ({ name: a.name, dayIndex: idx, startTime: '10:00' })),
        },
      ],
      cityIdByKey,
      lookup,
      { isPublic: true }
    )
  }
}

async function seedPosts(demoId: string, adminId: string, extras: { id: string }[]) {
  await db.post.deleteMany({})

  const authors = [demoId, adminId, ...extras.map((e) => e.id)]
  const posts = [
    { title: 'Paragliding above Chiang Mai was worth the 5am wake-up', tags: ['thailand', 'adventure', 'paragliding'] },
    { title: 'The Ha Long Bay day trip from Hanoi, honestly reviewed', tags: ['vietnam', 'daytrip'] },
    { title: 'Bali on a budget: what actually costs money', tags: ['bali', 'budget'] },
    { title: 'Dubai desert safari vs. the beach — which to pick', tags: ['dubai', 'adventure'] },
    { title: 'Kyoto in the off-season is a different city', tags: ['japan', 'kyoto'] },
    { title: 'Why we added a fourth day in Lisbon', tags: ['portugal', 'lisbon'] },
    { title: 'Rishikesh: rafting in the morning, yoga by sunset', tags: ['india', 'adventure', 'yoga'] },
    { title: 'Our Petra sunrise walk through the Siq', tags: ['jordan', 'petra'] },
    { title: 'Queenstown bungy jump: how we talked ourselves into it', tags: ['newzealand', 'adventure'] },
    { title: 'Copying a public itinerary saved us a week of planning', tags: ['tips', 'planning'] },
    { title: 'The one Bangkok rooftop bar worth the price', tags: ['thailand', 'nightlife'] },
    { title: 'Fiji parasailing over the Mamanuca lagoon', tags: ['fiji', 'adventure', 'parasailing'] },
  ]

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i]
    await db.post.create({
      data: {
        userId: authors[i % authors.length],
        title: p.title,
        body: `Notes from the road: ${p.title.toLowerCase()}. Happy to answer questions if you're planning something similar.`,
        tags: p.tags,
        likes: Math.floor(Math.random() * 40),
      },
    })
  }
}

async function main() {
  // Trips reference Activity rows via TripActivity, so clear them before the catalogue
  // is dropped and recreated below — otherwise the activity delete hits a FK constraint.
  console.log('Clearing existing trips...')
  await db.trip.deleteMany({})

  console.log('Seeding catalogue...')
  const { cityIdByKey } = await seedCatalogue()

  console.log('Seeding users...')
  const { demo, admin, extras } = await seedUsers()

  console.log('Seeding trips...')
  await seedTrips(demo.id, extras, cityIdByKey)

  console.log('Seeding community posts...')
  await seedPosts(demo.id, admin.id, extras)

  const [cityCount, activityCount, userCount, tripCount, postCount] = await Promise.all([
    db.city.count(),
    db.activity.count(),
    db.user.count(),
    db.trip.count(),
    db.post.count(),
  ])

  console.log(
    `seeded: ${cityCount} cities · ${activityCount} activities · ${userCount} users · ${tripCount} trips · ${postCount} posts`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
