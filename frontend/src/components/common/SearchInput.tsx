import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Search, X, Filter, Calendar, Folder } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { SearchFilters } from "@/lib/webApi";
import { useTranslation } from "react-i18next";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string, filters?: SearchFilters) => void;
  isSearching?: boolean;
  placeholder?: string;
  availableProjects?: Array<{ hash: string; name: string }>;
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  isSearching = false,
  placeholder,
  availableProjects = [],
}: SearchInputProps) {
  const { t } = useTranslation();
  const defaultPlaceholder = placeholder || t('search.searchConversations');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const onSearchRef = useRef(onSearch);

  // Keep the ref updated
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Debounced search (300ms like directory validation)
  useEffect(() => {
    if (!value.trim()) {
      return;
    }

    const timeoutId = setTimeout(() => {
      onSearchRef.current(value, filters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, filters]); // Removed onSearch from dependencies

  const handleClearSearch = () => {
    onChange("");
    setFilters({});
  };

  const hasActiveFilters =
    filters.project_hash || filters.date_range || filters.max_results;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className={`absolute left-3 top-2.5 h-4 w-4 ${isSearching ? "animate-pulse text-blue-500" : "text-gray-400"}`}
        />
        <Input
          type="text"
          placeholder={defaultPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10 pr-20"
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter
              className={`h-4 w-4 ${showFilters || hasActiveFilters ? "text-blue-500" : "text-gray-400"}`}
            />
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4 text-gray-400" />
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && !showFilters && (
        <div className="flex flex-wrap gap-1">
          {filters.project_hash && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              <Folder className="h-3 w-3 mr-1" />
              {t('search.project')}: {filters.project_hash.slice(0, 8)}...
              <Button
                variant="ghost"
                size="sm"
                className="h-3 w-3 p-0 ml-1"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, project_hash: undefined }))
                }
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
          {filters.date_range && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              <Calendar className="h-3 w-3 mr-1" />
              {t('search.dateRange')}
              <Button
                variant="ghost"
                size="sm"
                className="h-3 w-3 p-0 ml-1"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, date_range: undefined }))
                }
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
          {filters.max_results && filters.max_results !== 50 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {t('search.maxResults')}: {filters.max_results}
              <Button
                variant="ghost"
                size="sm"
                className="h-3 w-3 p-0 ml-1"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, max_results: undefined }))
                }
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
        </div>
      )}

      {/* Filters Panel - Similar to ConversationList directory section */}
      {showFilters && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('search.searchFilters')}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowFilters(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Project Filter */}
            {availableProjects.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t('search.project')}
                </label>
                <Select
                  value={filters.project_hash || ""}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      project_hash: value || undefined,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('search.allProjects')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('search.allProjects')}</SelectItem>
                    {availableProjects.map((project) => (
                      <SelectItem key={project.hash} value={project.hash}>
                        {project.name} ({project.hash.slice(0, 8)}...)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Results Limit */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {t('search.maxResults')}
              </label>
              <Select
                value={filters.max_results?.toString() || "50"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    max_results: parseInt(value),
                  }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({})}
                className="w-full h-8 text-xs"
              >
                {t('search.clearFilters')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
