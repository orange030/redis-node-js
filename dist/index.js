"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const moment = require("moment");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let prefix = 'js:object:';
let _redis;
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
    _redis = new ioredis_1.default(params.redisUrl, { maxRetriesPerRequest: null });
    setLuaFunction(_redis);
    prefix = params.prefix;
    if (prefix[prefix.length - 1] != ':') {
        prefix += ':';
    }
}
exports.Init = Init;
function getTimeLength(timeUnit, count) {
    return moment.duration(count, timeUnit || 'minute').asSeconds();
}
function getCacheTime(params) {
    let { timeUnit, offset, count } = params;
    let now = moment();
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
        this.prefix = prefix + params.prefix;
        this.timeUnit = params.timeUnit;
        this.offset = params.offset || 0;
        this.count = params.count || 1;
        this.expireBy = params.expireBy || 'request';
        if (params.redisUrl) {
            this._redis = new ioredis_1.default(params.redisUrl, { maxRetriesPerRequest: null });
            setLuaFunction(this._redis);
        }
        if (this.offset < 0 || this.offset > getTimeLength(params.timeUnit, 1)) {
            throw new Error('Error offset in RedisObject.constructor ' + params.timeUnit + ' ' + this.offset);
        }
    }
    redis() {
        return this._redis || _redis;
    }
    getPrefix() {
        // let { startTimestamp, expire } = getCacheTime({timeUnit:this.timeUnit,count:this.count,offset:this.offset})
        // let date = startTimestamp.valueOf()
        // let key = this.prefix + ':' + date
        // return key
        return this.prefix;
    }
    getPrefixAndExpires() {
        let startTimestamp, expire;
        if (this.expireBy === 'timeUnit') {
            let result = getCacheTime({ timeUnit: this.timeUnit, count: this.count, offset: this.offset });
            startTimestamp = result.startTimestamp;
            expire = result.expire;
        }
        else if (this.expireBy === 'request') {
            startTimestamp = moment();
            expire = getTimeLength(this.timeUnit, this.count);
        }
        else {
            console.error('error expireBy ' + this.expireBy);
            startTimestamp = moment();
            expire = getTimeLength(this.timeUnit, this.count);
        }
        // let {startTimestamp,expire} = getCacheTime({timeUnit:this.timeUnit,count:this.count,offset:this.offset})
        // let { startTimestamp, expire } = getCacheTime(this.timeUnit, this.offset)
        let date = startTimestamp.valueOf();
        let key = this.prefix;
        return { key, expire };
    }
    async set(k, v) {
        let { key, expire } = this.getPrefixAndExpires();
        return this.redis()
            .pipeline()
            //@ts-ignore
            .hsetex(key, k, v, expire)
            // .expire(key, expire)
            .exec();
    }
    /**
     * Inserts new elements at the start of an array.
     */
    async unshift(k, ...values) {
        let { key, expire } = this.getPrefixAndExpires();
        let path = await this.getListPath(k);
        return this.redis()
            .pipeline()
            .lpush(key + ':' + path, values)
            .expire(key + ':' + path, expire)
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
        let { key, expire } = this.getPrefixAndExpires();
        let path = await this.getListPath(k);
        return this.redis()
            .pipeline()
            .rpush(key + ':' + path, values)
            .expire(key + ':' + path, expire)
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
        let { key, expire } = this.getPrefixAndExpires();
        return this.redis()
            .pipeline()
            //@ts-ignore
            .incrbyex(key, k, increment, expire)
            // .expire(key, expire)
            .exec();
    }
    async incr(k) {
        return this.incrby(k, 1);
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