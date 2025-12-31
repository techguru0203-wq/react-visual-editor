import { useEffect, useState } from 'react';
import { Prisma } from '@prisma/client';
import { JsonObject } from '@prisma/client/runtime/library';
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  message,
  Row,
  Select,
  Spin,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router';

import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import {
  getSpecialtyTranslationKey,
  useLanguage,
} from '../../../common/contexts/languageContext';
import trackEvent from '../../../trackingClient';
import { LoadingScreen } from '../../layout/components/LoadingScreen';
import { useUpdateOrganizationMutation } from '../../organization/api/getOrganizationUsersApi';
import { useOrganization } from '../../organization/hooks/useOrganization';
import { useSpecialties } from '../../organization/hooks/useSpecialties';
import { getCompanyInfo } from '../api/profileApi';
import { useUpdateProfileMutation } from '../hooks/useUpdateProfileMutation';
import useUserProfileQuery from '../hooks/useUserProfileQuery';

import './Profile.scss';

// All translation mappings moved to languageContext.tsx for centralized management

type FormValues = {
  email?: string;
  firstname?: string;
  lastname?: string;
  specialty?: string;
  velocity?: number;
  enableProposalGen?: boolean;
  companyName?: string;
  companySize?: string;
  companyIndustry?: string;
  companyWebsite?: string;
};

interface EditProfileProps {
  requireCompanyData: boolean;
  requireProfileData: boolean;
  closeModal?: () => void;
}

const industryOptionsMap = [
  { value: 'Agriculture' },
  { value: 'Automotive' },
  { value: 'Banking' },
  { value: 'Construction' },
  { value: 'Consumer Goods' },
  { value: 'Education' },
  { value: 'Energy' },
  { value: 'Entertainment' },
  { value: 'Financial Services' },
  { value: 'Food & Beverage' },
  { value: 'Healthcare' },
  { value: 'Hospitality' },
  { value: 'Insurance' },
  { value: 'Manufacturing' },
  { value: 'Media & Advertising' },
  { value: 'Real Estate' },
  { value: 'Retail' },
  { value: 'Technology' },
  { value: 'Telecommunications' },
  { value: 'Transportation & Logistics' },
];

export default function EditProfile({
  requireCompanyData,
  requireProfileData,
  closeModal,
}: EditProfileProps) {
  const { user: currentUserProfile } = useCurrentUser();
  const { t } = useLanguage();
  const { data: specialties } = useSpecialties();
  const userId = currentUserProfile.id;
  const [industryOptions, setIndustryOptions] =
    useState<Array<{ value: string }>>(industryOptionsMap);

  const navigator = useNavigate();

  const handleSearch = (value: string) => {
    if (!value) {
      setIndustryOptions(industryOptionsMap);

      return;
    }

    const filteredOptions = industryOptions.filter((option) =>
      option.value.toLowerCase().includes(value.toLowerCase())
    );
    setIndustryOptions(filteredOptions);
  };

  if (!userId) {
    throw new Error('userId is required');
  }

  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>();
  const [spinning, setSpinning] = useState(false);

  const {
    data: existingProfile,
    isLoading,
    isError,
    isSuccess,
    error,
  } = useUserProfileQuery(userId);
  const { data: companyData } = useOrganization();
  const updateOrgMutation = useUpdateOrganizationMutation({
    onSuccess: () => {
      setErrorMsg(undefined);
    },
  });

  const updateProfileMutation = useUpdateProfileMutation({
    onSuccess: () => {
      setErrorMsg(undefined);
      message.success(t('profile.updateSuccess'));
      if (!currentUserProfile.specialty) {
        navigator('/issues');
      }
    },
    onError: (error) => setErrorMsg(error.toString()),
  });

  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    let meta = companyData?.meta as Prisma.JsonObject;
    form.setFieldsValue({
      email: existingProfile?.email as string,
      firstname: existingProfile?.firstname as string,
      lastname: existingProfile?.lastname as string,
      specialty: existingProfile?.specialty as string,
      companyWebsite: companyData?.website as string,
      companyName: companyData?.name as string,
      companySize: meta?.size as string,
      companyIndustry: meta?.industry as string,
    });
  }, [companyData, form, existingProfile]);

  if (isError) {
    setErrorMsg(
      t('profile.loadingError') + (error || 'unknown error').toString()
    );
  }

  const onFormValueChanged = () => {
    const hasErrors = form.getFieldsError().some(({ errors }) => errors.length);
    const isDirty = form.isFieldsTouched();
    setSubmitDisabled(!isDirty || hasErrors);
  };

  const onSubmit = (formValues: FormValues) => {
    console.log(
      'updating profile with these values',
      formValues,
      existingProfile
    );
    const {
      firstname,
      lastname,
      specialty,
      velocity,
      enableProposalGen,
      companyName,
      companySize,
      companyIndustry,
      companyWebsite,
    } = formValues;
    const { email, organizationId } = existingProfile || {};
    const profileReqsIsEmpty =
      !email || !organizationId || !firstname || !lastname;
    const companyReqsIsEmpty =
      !companyName || !companySize || !companyIndustry || !companyWebsite;

    if (
      (requireProfileData && profileReqsIsEmpty) ||
      (requireCompanyData && companyReqsIsEmpty)
    ) {
      setErrorMsg(t('profile.fillRequired'));
    } else {
      updateProfileMutation.mutate({
        id: userId,
        organizationId: organizationId!,
        email: email!,
        username: `${firstname} ${lastname}`,
        firstname: firstname!,
        lastname: lastname!,
        specialty,
        velocity,
        enableProposalGen,
      });

      updateOrgMutation.mutate({
        id: organizationId!,
        industry: companyIndustry!,
        name: companyName!,
        size: companySize!,
        website: companyWebsite!,
      });

      // track user profile update
      const updates = Object.keys(formValues).reduce((acc, key: string) => {
        if (
          formValues[key as keyof typeof formValues] !==
          (existingProfile || {})[key as keyof typeof existingProfile]
        ) {
          acc[key] = formValues[key as keyof typeof formValues];
        }
        return acc;
      }, {} as JsonObject);

      trackEvent('updateProfile', {
        distinct_id: email,
        payload: JSON.stringify({
          userId: userId,
          updates: JSON.stringify(updates),
        }),
      });
    }
  };

  const inputHandle = () => {
    let website = form.getFieldValue('companyWebsite')?.toLowerCase();
    setSpinning(true);
    setErrorMsg('');
    getCompanyInfo(website)
      .then((res) => {
        let { name, size, industry } = res;
        if (name) form.setFieldValue('companyName', name);
        if (size) {
          let sizeList = ['no ', 'small', 'medium', 'thousands'];
          let sizeIdx = Math.max(
            0,
            sizeList.findIndex((i) => size.toLowerCase().includes(i))
          );
          const companySizes = ['<50', '50-300', '300-500', '>500'];
          form.setFieldValue('companySize', companySizes[sizeIdx]);
        }
        if (industry)
          form.setFieldValue(
            'companyIndustry',
            industryOptionsMap.find((i) =>
              industry.toLowerCase().includes(i.value.toLowerCase())
            )?.value
          );
      })
      .catch((err) => {
        console.log(err);
        setErrorMsg(err);
      })
      .finally(() => {
        setSpinning(false);
      });
  };

  const getValidationRules = (fieldName: string, isRequired: boolean) => {
    const baseRules = [
      { required: isRequired, message: t('profile.fillRequired') },
    ];

    return baseRules;
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="profile-form">
      <Spin spinning={spinning}>
        <Typography.Title level={4} className="main-heading">
          {currentUserProfile.specialty
            ? t('profile.updateProfile')
            : t('profile.completeProfile')}
        </Typography.Title>
        <Form
          form={form}
          name="UserProfile"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          onFieldsChange={onFormValueChanged}
          onFinish={onSubmit}
          autoComplete="off"
          disabled={isLoading || !isSuccess}
          className="user-profile-form"
        >
          <Form.Item label={t('profile.email')} name="email">
            <Input disabled />
          </Form.Item>
          <Form.Item label={t('profile.name')} required>
            <Row>
              <Col span={12} style={{ paddingRight: '4px' }}>
                <Form.Item
                  name="firstname"
                  noStyle
                  rules={getValidationRules('first name', requireProfileData)}
                >
                  <Input placeholder={t('profile.firstName')} />
                </Form.Item>
              </Col>
              <Col span={12} style={{ paddingLeft: '4px' }}>
                <Form.Item
                  name="lastname"
                  noStyle
                  rules={getValidationRules('last name', requireProfileData)}
                >
                  <Input placeholder={t('profile.lastName')} />
                </Form.Item>
              </Col>
            </Row>
          </Form.Item>
          <Form.Item
            label={t('profile.role')}
            name="specialty"
            tooltip={t('profile.roleTooltip')}
            rules={getValidationRules('role', requireProfileData)}
          >
            <Select>
              <Select.Option value={''}>
                {t('profile.selectRole')}
              </Select.Option>
              {specialties
                ?.filter((item) => item.name !== '' && item.displayName !== '')
                .map((sp, index) => (
                  <Select.Option key={index} value={sp.name}>
                    {t(getSpecialtyTranslationKey(sp.displayName))}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={t('profile.website')}
            name="companyWebsite"
            rules={getValidationRules('website', requireCompanyData)}
          >
            <Input
              placeholder={t('profile.websitePlaceholder')}
              // onInput={debounce(inputHandle, 2000)}
            />
          </Form.Item>
          <Form.Item
            label={t('profile.organizationName')}
            name="companyName"
            rules={getValidationRules('company name', requireCompanyData)}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t('profile.organizationSize')}
            name="companySize"
            rules={getValidationRules('company size', requireCompanyData)}
          >
            <Select>
              <Select.Option value="<50">
                {t('companySize.under50')}
              </Select.Option>
              <Select.Option value="50-300">
                {t('companySize.50to300')}
              </Select.Option>
              <Select.Option value="300-500">
                {t('companySize.300to500')}
              </Select.Option>
              <Select.Option value=">500">
                {t('companySize.over500')}
              </Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label={t('profile.industry')}
            name="companyIndustry"
            rules={getValidationRules('industry', requireCompanyData)}
          >
            <Select>
              <Select.Option value={''}>
                {t('profile.selectIndustry')}
              </Select.Option>
              <Select.Option value="Agriculture">
                {t('industry.agriculture')}
              </Select.Option>
              <Select.Option value="Automotive">
                {t('industry.automotive')}
              </Select.Option>
              <Select.Option value="Banking">
                {t('industry.banking')}
              </Select.Option>
              <Select.Option value="Construction">
                {t('industry.construction')}
              </Select.Option>
              <Select.Option value="Consumer Goods">
                {t('industry.consumerGoods')}
              </Select.Option>
              <Select.Option value="Education">
                {t('industry.education')}
              </Select.Option>
              <Select.Option value="Energy">
                {t('industry.energy')}
              </Select.Option>
              <Select.Option value="Entertainment">
                {t('industry.entertainment')}
              </Select.Option>
              <Select.Option value="Financial Services">
                {t('industry.financialServices')}
              </Select.Option>
              <Select.Option value="Food & Beverage">
                {t('industry.foodBeverage')}
              </Select.Option>
              <Select.Option value="Healthcare">
                {t('industry.healthcare')}
              </Select.Option>
              <Select.Option value="Hospitality">
                {t('industry.hospitality')}
              </Select.Option>
              <Select.Option value="Insurance">
                {t('industry.insurance')}
              </Select.Option>
              <Select.Option value="Manufacturing">
                {t('industry.manufacturing')}
              </Select.Option>
              <Select.Option value="Media & Advertising">
                {t('industry.mediaAdvertising')}
              </Select.Option>
              <Select.Option value="Real Estate">
                {t('industry.realEstate')}
              </Select.Option>
              <Select.Option value="Retail">
                {t('industry.retail')}
              </Select.Option>
              <Select.Option value="Technology">
                {t('industry.technology')}
              </Select.Option>
              <Select.Option value="Telecommunications">
                {t('industry.telecommunications')}
              </Select.Option>
              <Select.Option value="Transportation & Logistics">
                {t('industry.transportationLogistics')}
              </Select.Option>
            </Select>
          </Form.Item>
          {/* <Form.Item
          label="Velocity"
          name="velocity"
          tooltip="Story points you can complete every 2 weeks"
        >
          <Input placeholder="Usually a number between 5-15" type="number" />
        </Form.Item> */}
          {errorMsg && (
            <Form.Item
              wrapperCol={{
                xs: { offset: 0, span: 24 },
                sm: { offset: 8, span: 16 },
              }}
            >
              <Alert type="error" message={errorMsg} />
            </Form.Item>
          )}
          <Form.Item
            wrapperCol={{
              xs: { offset: 0, span: 24 },
              sm: { offset: 8, span: 16 },
            }}
          >
            <Button
              type="primary"
              htmlType="submit"
              disabled={submitDisabled}
              loading={updateProfileMutation.isLoading}
            >
              {t('profile.save')}
            </Button>
          </Form.Item>
        </Form>
      </Spin>
    </div>
  );
}
