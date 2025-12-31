import React from 'react';
import { Select, SelectProps, Space } from 'antd';

import { useLanguage } from '../contexts/languageContext';
import COLORS from '../util/color';
import { LANGUAGES } from '../util/language';

const LanguageSelect: React.FC<SelectProps> = ({ ...rest }) => {
  const { t } = useLanguage();

  return (
    <Select
      {...rest}
      showSearch
      optionFilterProp="label" // Using the label for filtering
      filterOption={(input, option) => {
        console.log(option, input);
        return (option?.label as string)
          .toLowerCase()
          .includes(input.toLowerCase());
      }}
      placeholder={t('language.selectPlaceholder')}
    >
      {LANGUAGES?.map((lang, index) => (
        <Select.Option
          key={index}
          value={lang.code}
          label={lang.name + ' ' + lang.nativeName}
        >
          <Space>
            {lang.name}
            <span style={{ color: COLORS.gray[500] }}>{lang.nativeName}</span>
          </Space>
        </Select.Option>
      ))}
    </Select>
  );
};

export default LanguageSelect;
