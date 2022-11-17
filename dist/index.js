"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const moment_1 = __importDefault(require("moment"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let prefix = 'js:object:';
// function isNumeric(str: string) {
//   if (typeof str !== "string") return false // we only process strings!  
//   return !isNaN(str as any) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
//          !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
// }
/**
 * 用来缓存内部使用的ioredis实例，key是redis的url，值是实例
 */
const INTERNAL_REDIS_INS = {};
function setLuaFunction(redis) {
    redis.defineCommand('incrbyex', {
        numberOfKeys: 4,
        lua: fs_1.default.readFileSync(path_1.default.resolve(__dirname, 'incrbyex.lua')).toString()
    });
    redis.defineCommand('hsetex', {
        numberOfKeys: 4,
        lua: fs_1.default.readFileSync(path_1.default.resolve(__dirname, 'hsetex.lua')).toString()
    });
}
function Init(params) {
    INTERNAL_REDIS_INS.default = params.redisUrl ?
        new ioredis_1.default(params.redisUrl || undefined, { maxRetriesPerRequest: null }) :
        new ioredis_1.default({ maxRetriesPerRequest: null });
    setLuaFunction(INTERNAL_REDIS_INS.default);
    prefix = params.prefix;
    if (prefix[prefix.length - 1] != ':') {
        prefix += ':';
    }
}
exports.Init = Init;
function getTimeLength(timeUnit, count) {
    return moment_1.default.duration(count, timeUnit || 'minute').asSeconds();
}
function getCacheTime(params) {
    let { timeUnit, offset, count } = params;
    let now = moment_1.default();
    // let startTimestamp = now.startOf('day')
    let expire = 60 * 60 * 24;
    // if (timeUnit)
    // {
    let startTimestamp = now.clone().startOf(timeUnit).add(offset, 'second');
    //使offset支持负数
    if (startTimestamp.isAfter(now)) {
        // console.log('before time')
        startTimestamp = now.clone().subtract(1, timeUnit).startOf(timeUnit).add(offset, 'second');
    }
    // cacheKeyConfig['cacheTime'] = startTimestamp.toDate()
    let expireTimestamp = startTimestamp
        .clone()
        .add(count, timeUnit)
        .add(1, (timeUnit === 'second') ? 'second' : 'minute');
    expire = Math.floor((expireTimestamp.valueOf() - now.valueOf()) / 1000);
    // }
    return { startTimestamp, expire };
}
class RedisObject {
    constructor(params) {
        this.timeUnit = 'hour';
        /**
         * 时间偏移量,单位为秒
         */
        this.offset = 0;
        this.prefix = '';
        this.redisUrl = undefined;
        this.prefix = prefix + params.prefix;
        this.redisUrl = params.redisUrl;
        this.timeUnit = params.timeUnit;
        this.offset = params.offset || 0;
        this.count = params.count || 1;
        this.expireBy = params.expireBy || 'request';
        if (params.redisUrl && !INTERNAL_REDIS_INS[params.redisUrl]) {
            INTERNAL_REDIS_INS[params.redisUrl] = new ioredis_1.default(params.redisUrl, { maxRetriesPerRequest: null });
            setLuaFunction(INTERNAL_REDIS_INS[params.redisUrl]);
        }
        if (this.offset < 0 || this.offset > getTimeLength(params.timeUnit, 1)) {
            throw new Error('Error offset in RedisObject.constructor ' + params.timeUnit + ' ' + this.offset);
        }
    }
    redis() {
        const ins = INTERNAL_REDIS_INS[this.redisUrl || 'default'];
        if (!ins)
            throw new Error('No redis instance, please call init or specify redis url in constructor');
        return ins;
    }
    getPrefix() {
        return this.prefix;
    }
    getExpires() {
        let startTimestamp, expire;
        if (this.expireBy === 'timeUnit') {
            let result = getCacheTime({ timeUnit: this.timeUnit, count: this.count, offset: this.offset });
            startTimestamp = result.startTimestamp;
            expire = result.expire;
        }
        else if (this.expireBy === 'request') {
            startTimestamp = moment_1.default();
            expire = getTimeLength(this.timeUnit, this.count);
        }
        else {
            console.error('error expireBy ' + this.expireBy);
            startTimestamp = moment_1.default();
            expire = getTimeLength(this.timeUnit, this.count);
        }
        return expire;
    }
    /** 判断这个redis object，也就是hash对象，在redis里是否存在 */
    async exist() {
        // ioredis这里返回的是存在的key的数量
        const n = await this.redis().exists(this.getPrefix());
        return n === 1;
    }
    async delete(...fields) {
        let key = this.getPrefix();
        return this.redis().hdel(key, ...fields);
    }
    async set(k, v) {
        let expire = this.getExpires();
        return this.redis()
            .pipeline()
            //@ts-ignore
            .hsetex(this.getPrefix(), k, v, expire)
            .exec();
    }
    /**
     * Inserts new elements at the start of an array.
     */
    async unshift(k, ...values) {
        let expire = this.getExpires();
        let path = await this.getListPath(k);
        return this.redis()
            .pipeline()
            .lpush(this.getPrefix() + ':' + path, values)
            .expire(this.getPrefix() + ':' + path, expire)
            .exec();
    }
    /**
     *  Removes the first element from an array and returns it.
     */
    async shift(k) {
        let path = await this.getListPath(k);
        return this.redis().lpop(this.getPrefix() + ':' + path);
    }
    /**
     * Appends new elements to an array
     */
    async push(k, ...values) {
        let expire = this.getExpires();
        let path = await this.getListPath(k);
        return this.redis()
            .pipeline()
            .rpush(this.getPrefix() + ':' + path, values)
            .expire(this.getPrefix() + ':' + path, expire)
            .exec();
    }
    /**
     * Removes the last element from an array and returns it.
     */
    async pop(k) {
        [].push;
        let path = await this.getListPath(k);
        return this.redis().rpop(this.getPrefix() + ':' + path);
    }
    /**
     * Returns a section of an array.
     * These offsets can also be negative numbers indicating offsets starting at the end of the list. For example, -1 is the last element of the list, -2 the penultimate, and so on.
     */
    async slice(k, start, end) {
        let path = await this.getListPath(k);
        return this.redis().lrange(this.getPrefix() + ':' + path, start, end);
    }
    /**
     * 返回list类型中的所有元素
     */
    async list(k) {
        return this.slice(k, 0, -1);
    }
    async get(k) {
        return this.redis().hget(this.getPrefix(), k);
    }
    async gets(keys) {
        let prefix = this.getPrefix();
        let pipeline = this.redis().pipeline();
        keys.forEach(k => pipeline.hget(prefix, k));
        return (await pipeline.exec()).map(e => e[1]);
    }
    async getAll() {
        let result = await this.redis().hgetall(this.getPrefix());
        let keys = Object.keys(result);
        let refs = keys.filter(e => e[0] == '*');
        for (let i = 0; i < refs.length; ++i) {
            let r = refs[i];
            let k = r.substr(r.indexOf('@') + 1);
            delete result[r];
            //@ts-ignore
            result[k] = await this.list(k);
        }
        return result;
    }
    async incrby(k, increment) {
        let expire = this.getExpires();
        return this.redis()
            .pipeline()
            //@ts-ignore
            .incrbyex(this.getPrefix(), k, increment, expire)
            .exec();
    }
    async incr(k) {
        return this.incrby(k, 1);
    }
    async clear() {
        let result = await this.redis().hgetall(this.getPrefix());
        let keys = Object.keys(result);
        let refs = keys.filter(e => e[0] == '*');
        let pipeline = this.redis().pipeline();
        pipeline.del(this.getPrefix());
        for (let i = 0; i < refs.length; ++i) {
            let r = refs[i];
            let k = r.substr(r.indexOf('@') + 1);
            //@ts-ignore
            let path = await this.getListPath(k);
            let path2 = this.getPrefix() + ':' + path;
            pipeline.del(path2);
        }
        return pipeline.exec();
    }
    /**
     * 获取当前redis的内存使用情况
     */
    async memory() {
        let content = await this.redis().info('memory');
        let stats = content.split(/\s+/).filter(c => !!c && (c.includes('used_memory:') || c.includes('total_system_memory:')));
        const res = {
            total_system_memory: -1,
            usage: -1,
            used_memory: -1
        };
        stats.forEach(s => {
            const kv = s.split(':');
            const k = kv[0].trim();
            let v = kv[1].trim();
            if ((/^\d+$/g).test(v)) {
                // @ts-ignore
                res[k] = parseInt(v);
            }
        });
        res.usage = res.used_memory / res.total_system_memory;
        return res;
    }
    getListKey(k) {
        return '*list@' + k;
    }
    async getListPath(k) {
        let key = this.getListKey(k);
        //@ts-ignore
        let path = await this.get(key);
        if (!path) {
            path = Date.now() + '-' + Math.random().toString().substr(2);
            //@ts-ignore
            await this.set(key, path);
        }
        return path;
    }
}
exports.RedisObject = RedisObject;
// interface TestInterface {
//   name: string
//   count: number
// }
// async function testFunc() {
//   console.log('RedisObject')
//   let test = new RedisObject<TestInterface>({
//     prefix: 'test',
//     timeUnit: 'day',
//     offset: 7320
//   })
//   console.log(await test.getAll())
//   await test.incr("count")
//   console.log(await test.getAll())
// }
// testFunc()
//# sourceMappingURL=index.js.map