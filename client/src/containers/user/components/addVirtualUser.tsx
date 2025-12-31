import { useCallback } from 'react';
import { Button, Flex, Form, Input, Select } from 'antd';

import { getSpecialtyTranslationKey, useLanguage } from '../../../common/contexts/languageContext';
import { useSpecialties } from '../../organization/hooks/useSpecialties';
import useUserMutation from '../hooks/useUserMutation';

type AddTeamProps = Readonly<{
  parentTeamId?: string;
  onSuccess: () => void;
}>;

type FormValues = Readonly<{
  firstname?: string;
  lastname?: string;
  specialty: string;
  velocity?: number;
  email: string;
}>;

export function AddVirtualUser({ parentTeamId, onSuccess }: AddTeamProps) {
  const [form] = Form.useForm();
  const { data: specialties } = useSpecialties();
  const { t } = useLanguage();

  const onError = useCallback((error: unknown) => {
    throw error;
  }, []);
  const { createVirtualUserMutation } = useUserMutation({ onSuccess, onError });

  const onFinish = useCallback(
    ({ firstname, lastname, specialty, velocity }: Required<FormValues>) => {
      createVirtualUserMutation.mutate({
        email: ' ',
        firstname,
        lastname,
        specialty,
        velocity,
      });
    },
    [createVirtualUserMutation]
  );

  return (
    <Flex justify="center">
      <Form
        form={form}
        name="addVirtualUser"
        size="large"
        labelCol={{ span: 8 }}
        wrapperCol={{ flex: 1 }}
        onFinish={onFinish}
      >
        <Form.Item
          name="firstname"
          label={t('user.firstName')}
          rules={[{ required: true, message: t('user.firstNameRequired') }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="lastname"
          label={t('user.lastName')}
          rules={[{ required: true, message: t('user.lastNameRequired') }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t('user.specialty')}
          name="specialty"
          tooltip={t('user.specialtyTooltip')}
          rules={[{ required: true, message: t('user.specialtyRequired') }]}
        >
          <Select>
            {specialties?.map((sp) => {
              const translationKey = getSpecialtyTranslationKey(sp.displayName);
              const translatedName = translationKey !== sp.displayName ? t(translationKey) : sp.displayName;
              return (
                <Select.Option key={sp.name} value={sp.name}>
                  {translatedName}
                </Select.Option>
              );
            })}
          </Select>
        </Form.Item>

        <Form.Item
          label={t('user.velocity')}
          name="velocity"
          tooltip={t('user.velocityTooltip')}
        >
          <Input type="number" />
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 6, span: 16 }}>
          <Button type="primary" htmlType="submit">
            {t('user.submit')}
          </Button>
        </Form.Item>
      </Form>
    </Flex>
  );
}
