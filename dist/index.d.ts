export declare function Init(params: {
    redisUrl?: string;
    prefix: string;
}): void;
export declare class RedisObject<T = {
    [key: string]: string | number;
}> {
    private expireBy;
    private redis;
    private timeUnit;
    /**
     * 时间偏移量,单位为秒
     */
    private offset;
    private count;
    private prefix;
    private redisUrl;
    private getPrefix;
    private getPrefixAndExpires;
    constructor(params: {
        /**
         * 存储名,比如RA, RS, prac:RA , prac:RS
         */
        prefix: string;
        timeUnit: 'day' | 'hour' | 'minute' | 'month' | 'second';
        /**
         * 时间的偏移,以秒为单位
         */
        offset?: number;
        redisUrl?: string;
        /**
         * 缓存时长,单位为timeUnit,默认为1
         */
        count?: number;
        /**
         * 过期时间基于时间单位还是请求时间. 默认request. timeUnit为某个时间单位的整点开始即时,request为请求的时候开始计时
         */
        expireBy?: 'timeUnit' | 'request';
    });
    delete(...fields: (keyof T & string)[]): Promise<any>;
    set(k: keyof T & string, v: string | number): Promise<any>;
    /**
     * Inserts new elements at the start of an array.
     */
    unshift(k: keyof T & string, ...values: (string | number)[]): Promise<any>;
    /**
     *  Removes the first element from an array and returns it.
     */
    shift(k: keyof T & string): Promise<string | null>;
    /**
     * Appends new elements to an array
     */
    push(k: keyof T & string, ...values: (string | number)[]): Promise<any>;
    /**
     * Removes the last element from an array and returns it.
     */
    pop(k: keyof T & string): Promise<string | null>;
    /**
     * Returns a section of an array.
     * These offsets can also be negative numbers indicating offsets starting at the end of the list. For example, -1 is the last element of the list, -2 the penultimate, and so on.
     */
    slice(k: keyof T & string, start: number, end: number): Promise<string[]>;
    /**
     * 返回list类型中的所有元素
     */
    list(k: keyof T & string): Promise<string[]>;
    get(k: keyof T & string): Promise<string | null>;
    gets(keys: (keyof T & string)[]): Promise<(string | null)[]>;
    getAll(): Promise<{
        [P in keyof T]?: string;
    }>;
    incrby(k: keyof T & string, increment: number): Promise<any>;
    incr(k: keyof T & string): Promise<any>;
    clear(): Promise<any>;
    /**
     * 获取当前redis的内存使用情况
     */
    memory(): Promise<{
        used_memory: number;
        total_system_memory: number;
        usage: number;
    }>;
    private getListKey;
    private getListPath;
}
