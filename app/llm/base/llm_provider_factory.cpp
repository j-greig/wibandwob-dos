/*---------------------------------------------------------*/
/*                                                         */
/*   llm_provider_factory.cpp - LLM Provider Factory      */
/*                                                         */
/*---------------------------------------------------------*/

#include "llm_provider_factory.h"

LLMProviderFactory& LLMProviderFactory::getInstance() {
    static LLMProviderFactory instance;
    return instance;
}

void LLMProviderFactory::registerProvider(const std::string& name, ProviderFactory factory) {
    providers[name] = factory;
}

std::unique_ptr<ILLMProvider> LLMProviderFactory::createProvider(const std::string& name) {
    auto it = providers.find(name);
    if (it != providers.end()) {
        return it->second();
    }
    return nullptr;
}

std::vector<std::string> LLMProviderFactory::getAvailableProviders() const {
    std::vector<std::string> result;
    for (const auto& pair : providers) {
        result.push_back(pair.first);
    }
    return result;
}

bool LLMProviderFactory::isProviderRegistered(const std::string& name) const {
    return providers.find(name) != providers.end();
}