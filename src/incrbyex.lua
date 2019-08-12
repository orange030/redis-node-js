local key = KEYS[1]
local k = KEYS[2]
local increment = KEYS[3]
local expire = KEYS[4]

if( redis.call('EXISTS',key) == 1 )then
    redis.call('hincrby',key,k,increment) 
else
    redis.call('hincrby',key,k,increment) 
    redis.call('expire',key,expire) 
end