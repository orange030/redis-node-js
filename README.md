# redis-node-js
使用redis缓存js类中的数据, 支持set, 递增, 数组 等操作. 封装成ts接口, 可同时在js和ts下使用

```typescript
import { RedisObject, Init } from 'redis-node-js'

interface TestInterface {
  name: string
  count: number
  list:string[]
}

async function testFunc() {
    //初始化
    Init({
        //redis地址
        redisUrl: process.env.REDIS_URL as string,
        //缓存前缀
        prefix:'pteppp:object:'
    })

    console.log('RedisObject')
    let test = new RedisObject<TestInterface>({
    //缓存前缀
    prefix: 'test3',
    //缓存一天
    timeUnit: 'day',
    //使用时间单位设置过期,将在一天开始时过期
    expireBy:'timeUnit'
    })
    //获取所有数据
    console.log(await test.getAll())
    //获取list字段中的数据, 数据为数组类型
    console.log(await test.list('list'))
    //count字段自加1
    await test.incr("count")
    //pop出list字段最后一个数据
    console.log(await test.pop('list'))
    //push 字符串 '1' 进list字段
    await test.push('list','1')
    //push 字符串 '2' 进list字段
    await test.push('list','2')
    //返回list字段中,从0到1的元素
    console.log(await test.slice('list',0,1))
    //返回整个list数组字段
    console.log(await test.list('list'))
    //获取所有数据
    console.log(await test.getAll())
}
```