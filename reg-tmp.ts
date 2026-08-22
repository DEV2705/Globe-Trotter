import { checkRateLimit } from '@/lib/rate-limit'
// Simulate 12 sign-up attempts from one address under the new limit
const r = Array.from({length:12},()=>checkRateLimit('register','127.0.0.1',10,900_000))
console.log('allowed:', r.map(x=>x.success?'Y':'N').join(''))
console.log('login per-email isolation:',
  checkRateLimit('login','1.1.1.1:a@x.com',10,60000).success,
  checkRateLimit('login','1.1.1.1:b@x.com',10,60000).success)
