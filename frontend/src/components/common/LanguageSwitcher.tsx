import React from "react";
import { ChevronDownIcon, GlobeIcon, CheckIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { type SupportedLanguage } from "@/i18n/config";
import { cn } from "@/lib/utils";

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸'
  },
  {
    code: 'zh-CN',
    name: 'Simplified Chinese',
    nativeName: '简体中文',
    flag: '🇨🇳'
  },
  {
    code: 'zh-TW',
    name: 'Traditional Chinese',
    nativeName: '繁體中文',
    flag: '🇹🇼'
  }
];

interface LanguageSwitcherProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showFlag?: boolean;
  showText?: boolean;
  showChevron?: boolean;
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'ghost',
  size = 'default',
  showFlag = true,
  showText = true,
  showChevron = true,
  className,
}) => {
  const { currentLanguage, setLanguage } = useLanguage();
  
  const currentLang = SUPPORTED_LANGUAGES.find(lang => lang.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  const handleLanguageChange = (languageCode: SupportedLanguage) => {
    setLanguage(languageCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          'gap-1.5 transition-all duration-200',
          size !== 'icon' && 'w-auto px-3',
          size === 'icon' && 'h-10 w-10',
          size === 'sm' && 'h-9 px-3',
          size === 'lg' && 'h-11 px-8',
          size === 'default' && 'h-10 px-4 py-2',
          'hover:bg-accent/80 hover:text-accent-foreground',
          'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
          variant === 'outline' && 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          className
        )}
        title={currentLang ? currentLang.nativeName : 'Language'}
        aria-label="Language switcher"
      >
        {!showFlag && (
          <GlobeIcon className="h-4 w-4" />
        )}
        {showFlag && (
          <span 
            className="text-base leading-none"
            role="img" 
            aria-label={`${currentLang.nativeName} flag`}
          >
            {currentLang.flag}
          </span>
        )}
        {showText && size !== 'icon' && (
          <span className="text-sm font-medium hidden sm:inline-block">
            {currentLang.nativeName}
          </span>
        )}
        {showChevron && size !== 'icon' && (
          <ChevronDownIcon 
            className={cn(
              'h-3 w-3 transition-transform duration-200'
            )} 
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "min-w-[200px] bg-popover/95 backdrop-blur-sm border border-border/80",
          "shadow-lg animate-in slide-in-from-top-1 duration-150"
        )}
        sideOffset={8}
      >
        {SUPPORTED_LANGUAGES.map((language) => {
          const isSelected = currentLanguage === language.code;
          
          return (
            <DropdownMenuItem
              key={language.code}
              onSelect={() => {
                handleLanguageChange(language.code);
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 cursor-pointer',
                'transition-all duration-150',
                'hover:bg-accent/80 hover:text-accent-foreground',
                'focus:bg-accent/80 focus:text-accent-foreground',
                isSelected && 'bg-accent/60 text-accent-foreground'
              )}
            >
              <span 
                className="text-lg flex-shrink-0"
                role="img" 
                aria-label={`${language.nativeName} flag`}
              >
                {language.flag}
              </span>
              <div className="flex flex-col flex-1 gap-0.5">
                <span className={cn(
                  "text-sm leading-tight",
                  isSelected && "font-medium"
                )}>
                  {language.nativeName}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {language.name}
                </span>
              </div>
              {isSelected && (
                <CheckIcon 
                  className="h-4 w-4 text-primary flex-shrink-0" 
                  aria-label="Selected language"
                />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};