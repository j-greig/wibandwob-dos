/*---------------------------------------------------------*/
/*                                                         */
/*   path_search.h - Small path resolution helpers         */
/*                                                         */
/*   C++14-friendly: no std::filesystem.                    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef WIBWOB_PATH_SEARCH_H
#define WIBWOB_PATH_SEARCH_H

#include <string>
#include <vector>

#include <unistd.h> // access

inline bool ww_file_readable(const std::string& path) {
    return access(path.c_str(), R_OK) == 0;
}

inline std::vector<std::string> ww_up_prefixes(int maxUpLevels) {
    std::vector<std::string> prefixes;
    prefixes.reserve(static_cast<size_t>(maxUpLevels) + 1);
    prefixes.push_back("");

    std::string p;
    for (int i = 0; i < maxUpLevels; ++i) {
        p += "../";
        prefixes.push_back(p);
    }
    return prefixes;
}

inline std::string ww_find_first_existing_upwards(const std::vector<std::string>& relativePaths,
                                                  int maxUpLevels = 4) {
    const auto prefixes = ww_up_prefixes(maxUpLevels);
    for (const auto& prefix : prefixes) {
        for (const auto& rel : relativePaths) {
            const std::string candidate = prefix + rel;
            if (ww_file_readable(candidate)) {
                return candidate;
            }
        }
    }
    return "";
}

#endif // WIBWOB_PATH_SEARCH_H

