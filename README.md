# functionCache

Cache results of a given function with given arguments for a period of time.

```js
const returned = await functionCache.get((arg1, arg2) => {
    //do something
    return true
}, ['arg1', 'arg2'], 60000)
```

If the result of this function with this arguments is not cached, it will execute the function, save it in cache for 60 seconds, and return it. If it is cached, it will just return the result.
