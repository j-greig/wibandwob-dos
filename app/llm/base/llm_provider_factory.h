/*---------------------------------------------------------*/
/*                                                         */
/*   llm_provider_factory.h - LLM Provider Factory        */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef LLM_PROVIDER_FACTORY_H
#define LLM_PROVIDER_FACTORY_H

#include "illm_provider.h"
#include <map>
#include <string>
#include <memory>
#include <functional>
#include <vector>

class LLMProviderFactory {
public:
    // Provider creation function type
    using ProviderFactory = std::function<std::unique_ptr<ILLMProvider>()>;
    
    // Singleton access
    static LLMProviderFactory& getInstance();
    
    // Provider registration
    void registerProvider(const std::string& name, ProviderFactory factory);
    
    // Provider creation
    std::unique_ptr<ILLMProvider> createProvider(const std::string& name);
    
    // Provider discovery
    std::vector<std::string> getAvailableProviders() const;
    bool isProviderRegistered(const std::string& name) const;
    
    // Auto-registration helper
    template<typename T>
    void registerProvider(const std::string& name) {
        registerProvider(name, []() -> std::unique_ptr<ILLMProvider> {
            return std::make_unique<T>();
        });
    }

private:
    std::map<std::string, ProviderFactory> providers;
    
    // Singleton pattern
    LLMProviderFactory() = default;
    ~LLMProviderFactory() = default;
    LLMProviderFactory(const LLMProviderFactory&) = delete;
    LLMProviderFactory& operator=(const LLMProviderFactory&) = delete;
};

// Registration helper macro
#define REGISTER_LLM_PROVIDER(name, className) \
    namespace { \
        struct className##Registrar { \
            className##Registrar() { \
                LLMProviderFactory::getInstance().registerProvider<className>(name); \
            } \
        }; \
        static className##Registrar className##Instance; \
    }

#endif // LLM_PROVIDER_FACTORY_H