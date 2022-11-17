import { RedisObject, Init } from '../src/index'
import IORedis from 'ioredis';

Init({
  // redisUrl: "" as string,
  prefix:'js:object:'
})

export {RedisObject}

interface TestInterface {
  name: string
  count: number
  list:string[]
}
async function testFunc() {
  console.log('RedisObject')
  let test = new RedisObject<TestInterface>({
    prefix: 'test5',
    timeUnit: 'day',
    offset: 7320,
    expireBy:'timeUnit'
  })
  console.log(await test.exist());
  console.log(await test.getAll());
  console.log(await test.memory());
  console.log(await test.getAll())
  console.log(await test.list('list'))
  await test.incr("count")
  console.log(await test.pop('list'))
  await test.push('list','1')
  await test.push('list','2')
  console.log(await test.slice('list',0,1))
  console.log(await test.list('list'))
  console.log(await test.getAll())
  console.log(await test.exist());
}

async function testMGet() {
  const r = new IORedis()
  const keys = ['mgettest1', 'mgettest2', 'mgettest3']
  let prevRes = await r.mget(...keys)
  console.log(prevRes);
  for(let i = 0; i < keys.length; i++) {
    await r.hset(keys[i], 'a', 'v1')
    await r.hset(keys[i], 'b', 2)
  }

  let rp = r.pipeline()
  for(let i = 0; i < keys.length; i++) {
    rp.hgetall(keys[i])
  }
  prevRes = await rp.exec()
  console.log(prevRes);
  console.log(await r.hgetall(keys[0]));
  console.log(await r.hgetall(keys[1]));
  console.log(await r.hgetall(keys[2]));
  await r.hincrby(keys[2], 'b', 1)
  console.log(await r.hget(keys[2], 'b'));
  console.log(typeof (await r.hget(keys[2], 'b')));
}

describe('test',()=>{

  it('test',testFunc)

  it('mget', testMGet)
})
