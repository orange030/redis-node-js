import { RedisObject, Init } from '../src/index'

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
    prefix: 'test3',
    timeUnit: 'day',
    offset: 7320,
    expireBy:'timeUnit'
  })
  let i = await test.memory()
  console.log(await test.getAll())
  console.log(await test.list('list'))
  await test.incr("count")
  console.log(await test.pop('list'))
  await test.push('list','1')
  await test.push('list','2')
  console.log(await test.slice('list',0,1))
  console.log(await test.list('list'))
  console.log(await test.getAll())
}

describe('test',()=>{

  it('test',testFunc)
})
