local key = KEYS[1]
local k = KEYS[2]
local newKey = KEYS[3]
local expire = KEYS[4]

if( redis.call('EXISTS',key) == 1 )then
    return redis.call('hget',key,k) 
else
    redis.call('hset',key,k,value) 
    redis.call('expire',key,expire) 
end