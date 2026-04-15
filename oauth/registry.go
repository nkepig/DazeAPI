package oauth

import (
	"sync"
)

var (
	providers = make(map[string]Provider)
	mu         sync.RWMutex
)

func Register(name string, provider Provider) {
	mu.Lock()
	defer mu.Unlock()
	providers[name] = provider
}

func Unregister(name string) {
	mu.Lock()
	defer mu.Unlock()
	delete(providers, name)
}

func GetProvider(name string) Provider {
	mu.RLock()
	defer mu.RUnlock()
	return providers[name]
}

func GetAllProviders() map[string]Provider {
	mu.RLock()
	defer mu.RUnlock()
	result := make(map[string]Provider, len(providers))
	for k, v := range providers {
		result[k] = v
	}
	return result
}

func IsProviderRegistered(name string) bool {
	mu.RLock()
	defer mu.RUnlock()
	_, ok := providers[name]
	return ok
}