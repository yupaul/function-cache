const farmhash = require('farmhash')
const { stringifyFlatted, promisify } = require('./helper')

class FunctionCache {

    constructor(options) {        
        this.timeouts = {}
        this.data = {}
        this.setOptions(null, true)
    }

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
    
    async get(func, args, ttl, no_freeze, callback) {
        this.setOptions('set_callback', callback)
        if(!args || !Array.isArray(args)) args = []
        const key1 = farmhash.hash32(func.toString())
        const key2 = args.length ? farmhash.hash32(stringifyFlatted(args)) : 'empty'
        
        if(this.data[key1] !== undefined && this.data[key1][key2] !== undefined) return promisify(this.data[key1][key2].value)
        let result = func(...args)
        if(result instanceof Promise) result = await result

        if(this.set_callback) this.set_callback(this.set_event_name, [key1, key2, result, ttl || 0, Boolean(no_freeze)])         

        this.setWithKeys(key1, key2, result, ttl, no_freeze)
        return promisify(result)
    }

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

    delete(k, args, dont_clear_timeout, callback) {
        this.setOptions('delete_callback', callback)
        const _type = typeof k
        const key1 = _type !== 'string' && _type !== 'number' ? (_type === 'function' ? farmhash.hash32(k.toString()) : farmhash.hash32(stringifyFlatted(k))) : k
        
        const k2 = args ? farmhash.hash32(stringifyFlatted(args)) : null
        if(this.data[key1] !== undefined) {
            if(k2) {                
                delete this.data[key1][k2]		
                return
            }
            delete this.data[key1]
        }
        if(this.delete_callback && (k2 || !dont_clear_timeout)) this.delete_callback(this.delete_event_name, [key1, k2])        
        this.clearTimeout(key1, dont_clear_timeout)
    }

    deleteWithKeys(key1, k2) {
        if(this.data[key1] !== undefined) {
            if(k2) {
                delete this.data[key1][k2]
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
