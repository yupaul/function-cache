const farmhash = require('farmhash')
const { stringifyFlatted } = require('./helper')

class FunctionCache {

    constructor(options) {        
        this.timeouts = {}
        this.data = {}
        this.setOptions(null, true)
        if(options) this.setOptions(options)
    }

    /**
     * Set FunctionCache options.
     * @param {Object} options - object with options to set
     * @param {boolean} [init=false] - if true, will set intial values for options
     * @property {function} set_callback - callback to call on get (set), args are: eventName, [key1, key2, result, ttl, noFreeze]
     * @property {function} delete_callback - callback to call on delete, args are: eventName, [key1, key2]
     * @property {string} set_event_name - name of event to emit on set
     * @property {string} delete_event_name - name of event to emit on delete
     */
    setOptions(options, init) {
        if (!options) options = {
            set_callback: null,
            delete_callback: null,
            set_event_name: 'function_cache_set',
            delete_event_name: 'function_cache_delete',
        }
        for (let name in options) {
            this.setOption(name, options[name], init)
        }
    }
    
    setOption(name, value, init) {
        if(!init && this[name] === undefined) return
        const required_type = name.indexOf('callback') !== -1 ? 'function' : 'string'
        if (typeof value === required_type) this.name = value
    }
    
    /**
     * Get the result of a function from the cache. If the result does not exist in the cache, call the function and cache the result.
     * @param {function} func - the function to call if the result is not in the cache
     * @param {array} args - the arguments to pass to the function
     * @param {number} [ttl] - the number of milliseconds to cache the result for
     * @param {boolean} [no_freeze] - if true, do not freeze the value in the cache
     * @param {function} [callback] - the callback to call when the value is set in the cache
     * @returns {Promise<any>} the cached result, or the result of calling the function
     */
    async get(func, args, ttl, no_freeze, callback) {
        this.setOptions('set_callback', callback)
        if(!args || !Array.isArray(args)) args = []
        const key1 = farmhash.hash32(func.toString())
        const key2 = args.length ? farmhash.hash32(stringifyFlatted(args)) : 'empty'
        
        if(this.data[key1] !== undefined && this.data[key1][key2] !== undefined) return Promise.resolve(this.data[key1][key2].value)
        let result = func(...args)
        if(result instanceof Promise) result = await result

        if(this.set_callback) this.set_callback(this.set_event_name, [key1, key2, result, ttl || 0, Boolean(no_freeze)])         

        this.setWithKeys(key1, key2, result, ttl, no_freeze)
        return Promise.resolve(result)
    }

    /**
     * Set a value in the cache.
     * @param {string} key1 - the first part of the cache key
     * @param {string} key2 - the second part of the cache key
     * @param {any} result - the value to cache
     * @param {number} [ttl] - the number of milliseconds to cache the result for
     * @param {boolean} [no_freeze] - if true, do not freeze the value in the cache
     */
    setWithKeys(key1, key2, result, ttl, no_freeze) {
        if(!this.data[key1]) this.data[key1] = {}
        this.data[key1][key2] = {value: result}
        if(!no_freeze) Object.freeze(this.data[key1][key2])
        if(ttl && this.timeouts[key1] === undefined) {
            this.timeouts[key1] = setTimeout(() => {
                this.delete(key1, null, true)
            }, ttl)
        }        
    }

    /**
     * Delete a value from the cache.
     * @param {string|number|function} k - the first part of the cache key
     * @param {array} [args] - the arguments to pass to the function
     * @param {boolean} [dont_clear_timeout] - if true, do not clear the timeout
     * @param {function} [callback] - the callback to call when the value is deleted from the cache
     */
    delete(k, args, dont_clear_timeout, callback) {
        this.setOptions('delete_callback', callback)
        const _type = typeof k
        const key1 = _type !== 'string' && _type !== 'number' ? (_type === 'function' ? farmhash.hash32(k.toString()) : farmhash.hash32(stringifyFlatted(k))) : k
        
        const key2 = args ? farmhash.hash32(stringifyFlatted(args)) : null
        if(this.data[key1] !== undefined) {
            if(key2) {                
                delete this.data[key1][key2]		
                return
            }
            delete this.data[key1]
        }
        if(this.delete_callback && (key2 || !dont_clear_timeout)) this.delete_callback(this.delete_event_name, [key1, key2])        
        this.clearTimeout(key1, dont_clear_timeout)
    }

    /**
     * Delete a value from the cache with the given keys.
     * @param {string} key1 - the first part of the cache key
     * @param {string} [key2] - the second part of the cache key
     */
    deleteWithKeys(key1, key2) {
        if(this.data[key1] !== undefined) {
            if(key2) {
                delete this.data[key1][key2]
                return
            }
            delete this.data[key1]
        }
        this.clearTimeout(key1)        
    }

    clearTimeout(key1, dont_clear_timeout) {
        if(this.timeouts[key1] !== undefined) {
            if(!dont_clear_timeout) clearTimeout(this.timeouts[key1])
            delete this.timeouts[key1]
        }        
    }
}

module.exports = new FunctionCache()
