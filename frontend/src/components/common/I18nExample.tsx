import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * Example component demonstrating i18n usage
 * This component shows how to use translations in React components
 */
export const I18nExample: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage, setLanguage, languageNames } = useLanguage();

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t('common.language')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {t('common.status')}: {languageNames[currentLanguage]}
          </p>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('common.select')} {t('common.language')}:</p>
          <div className="flex gap-2">
            <Button
              variant={currentLanguage === 'en' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLanguage('en')}
            >
              English
            </Button>
            <Button
              variant={currentLanguage === 'zh-CN' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLanguage('zh-CN')}
            >
              简体中文
            </Button>
            <Button
              variant={currentLanguage === 'zh-TW' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLanguage('zh-TW')}
            >
              繁體中文
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">{t('common.examples', { defaultValue: 'Examples' })}:</h4>
          <ul className="text-sm space-y-1">
            <li>• {t('common.loading')}</li>
            <li>• {t('common.save')}</li>
            <li>• {t('common.cancel')}</li>
            <li>• {t('common.search')}</li>
            <li>• {t('common.add')}</li>
          </ul>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">{t('common.interpolation', { defaultValue: 'Interpolation' })}:</h4>
          <p className="text-sm">
            {t('validation.min_length', { min: 5, defaultValue: 'Minimum length is {{min}} characters' })}
          </p>
          <p className="text-sm">
            {t('time.minutes_ago', { count: 10, defaultValue: '{{count}} minutes ago' })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};