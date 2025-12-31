import { useEffect, useState } from 'react';
import { SelectProps } from 'antd';
import { ReactMultiEmail } from 'react-multi-email';

import { useLanguage } from '../contexts/languageContext';

import 'react-multi-email/dist/style.css';
import './mutil-email-input.scss';

export type MultiEmailInputProps = {
  value: string[];
  onChange?: SelectProps<string[]>['onChange'];
};

export const MultiEmailInput: React.FC<MultiEmailInputProps> = ({
  value,
  onChange,
  ...selectProps
}) => {
  const [emails, setEmails] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    onChange && onChange(emails, {});
  }, [emails]);

  return (
    <ReactMultiEmail
      placeholder={t('sharing.enterEmailToShare')}
      emails={emails}
      onChange={(_emails: string[]) => {
        setEmails(_emails);
      }}
      getLabel={(email, index, removeEmail) => {
        return (
          <div data-tag key={index}>
            <div data-tag-item>{email}</div>
            <span data-tag-handle onClick={() => removeEmail(index)}>
              ×
            </span>
          </div>
        );
      }}
    />
  );
};
