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
} from 'antd';

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

import './ProfilePopUp.scss';

// Helper functions now moved to languageContext.tsx for centralized management

const getCompanySizes = (language: string) => [
  { value: '<50', label: language === 'zh' ? '<50 员工' : '<50 employees' },
  {
    value: '50-300',
    label: language === 'zh' ? '50-300 员工' : '50-300 employees',
  },
  {
    value: '300-500',
    label: language === 'zh' ? '300-500 员工' : '300-500 employees',
  },
  { value: '>500', label: language === 'zh' ? '>500 员工' : '>500 employees' },
];

// Removed LANGUAGE_OPTIONS as it's no longer used

type FormValues = {
  email?: string;
  firstname?: string;
  lastname?: string;
  specialty?: string;
  velocity?: number;
  enableProposalGen?: boolean;
  referalSource?: string;
  companyName?: string;
  companySize?: string;
  companyIndustry?: string;
  companyWebsite?: string;
  language?: string;
};
type LayoutType = Parameters<typeof Form>[0]['layout'];
interface EditProfileProps {
  requireCompanyData: boolean;
  requireProfileData: boolean;
  closeModal?: () => void;
}

const getIndustryOptions = (language: string) => [
  { value: 'Agriculture', label: language === 'zh' ? '农业' : 'Agriculture' },
  { value: 'Automotive', label: language === 'zh' ? '汽车' : 'Automotive' },
  { value: 'Banking', label: language === 'zh' ? '银行业' : 'Banking' },
  {
    value: 'Construction',
    label: language === 'zh' ? '建筑业' : 'Construction',
  },
  {
    value: 'Consumer Goods',
    label: language === 'zh' ? '消费品' : 'Consumer Goods',
  },
  { value: 'Education', label: language === 'zh' ? '教育' : 'Education' },
  { value: 'Energy', label: language === 'zh' ? '能源' : 'Energy' },
  {
    value: 'Entertainment',
    label: language === 'zh' ? '娱乐' : 'Entertainment',
  },
  {
    value: 'Financial Services',
    label: language === 'zh' ? '金融服务' : 'Financial Services',
  },
  {
    value: 'Food & Beverage',
    label: language === 'zh' ? '食品饮料' : 'Food & Beverage',
  },
  { value: 'Healthcare', label: language === 'zh' ? '医疗保健' : 'Healthcare' },
  { value: 'Hospitality', label: language === 'zh' ? '酒店业' : 'Hospitality' },
  { value: 'Insurance', label: language === 'zh' ? '保险' : 'Insurance' },
  {
    value: 'Manufacturing',
    label: language === 'zh' ? '制造业' : 'Manufacturing',
  },
  {
    value: 'Media & Advertising',
    label: language === 'zh' ? '媒体广告' : 'Media & Advertising',
  },
  { value: 'Real Estate', label: language === 'zh' ? '房地产' : 'Real Estate' },
  { value: 'Retail', label: language === 'zh' ? '零售' : 'Retail' },
  { value: 'Technology', label: language === 'zh' ? '技术' : 'Technology' },
  {
    value: 'Telecommunications',
    label: language === 'zh' ? '电信' : 'Telecommunications',
  },
  {
    value: 'Transportation & Logistics',
    label: language === 'zh' ? '交通物流' : 'Transportation & Logistics',
  },
];

export default function EditProfilePopUp({
  requireCompanyData,
  requireProfileData,
  closeModal,
}: EditProfileProps) {
  const { user: currentUserProfile } = useCurrentUser();
  const { t, setLanguage, language } = useLanguage();
  const { data: specialties } = useSpecialties();
  const userId = currentUserProfile.id;
  const currentLanguage = language || 'en';

  // const navigator = useNavigate();

  if (!userId) {
    throw new Error('userId is required');
  }

  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>();
  const [spinning, setSpinning] = useState(false);
  const [hideForm, setHideForm] = useState(true);
  const [formLayout] = useState<LayoutType>('vertical');

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
      message.success('Your information has been saved successfully');
      setErrorMsg(undefined);
      closeModal?.();
    },
    onError: (error) => setErrorMsg(error.toString()),
  });

  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    const meta = (existingProfile?.meta as Prisma.JsonObject) ?? {};
    const orgMeta = (companyData?.meta as Prisma.JsonObject) ?? {};
    form.setFieldsValue({
      email: existingProfile?.email as string,
      firstname: existingProfile?.firstname as string,
      lastname: existingProfile?.lastname as string,
      specialty: existingProfile?.specialty as string,
      companyWebsite: companyData?.website as string,
      referalSource: meta?.referalSource as string,
      companyName: orgMeta?.name as string,
      companySize: orgMeta?.size as string,
      companyIndustry: orgMeta?.industry as string,
      language: (meta?.language as string) || 'en', // Default to English
    });
  }, [companyData, form, existingProfile]);

  if (isError) {
    setErrorMsg(
      'An error occurred while loading the existing profile: ' +
        (error || 'unknown error').toString()
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
      referalSource,
      companyName,
      companySize,
      companyIndustry,
      companyWebsite,
      language,
    } = formValues;
    const { email, organizationId } = existingProfile || {};
    const profileReqsIsEmpty =
      !email || !organizationId || !firstname || !lastname;
    const companyReqsIsEmpty =
      !companyData?.id &&
      (!companyName || !companySize || !companyIndustry || !companyWebsite);
    if (
      (requireProfileData && profileReqsIsEmpty) ||
      (requireCompanyData && companyReqsIsEmpty)
    ) {
      setErrorMsg('Please fill in all required values');
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
        referalSource,
        language,
      });

      // Update language context if language changed
      if (language) {
        setLanguage(language as 'en' | 'zh');
      }

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

    // Auto-add https:// if no protocol is provided
    if (
      website &&
      !website.startsWith('http://') &&
      !website.startsWith('https://')
    ) {
      website = `https://${website}`;
      form.setFieldValue('companyWebsite', website);
    }

    if (website) {
      setSpinning(true);
      setHideForm(true);
      setErrorMsg('');
      getCompanyInfo(website)
        .then((res: any) => {
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
          if (industry) {
            // Industry auto-detection logic simplified
            const industries = [
              'Agriculture',
              'Automotive',
              'Banking',
              'Construction',
              'Consumer Goods',
              'Education',
              'Energy',
              'Entertainment',
              'Financial Services',
              'Food & Beverage',
              'Healthcare',
              'Hospitality',
              'Insurance',
              'Manufacturing',
              'Media & Advertising',
              'Real Estate',
              'Retail',
              'Technology',
              'Telecommunications',
              'Transportation & Logistics',
            ];
            const matchedIndustry = industries.find((ind) =>
              industry.toLowerCase().includes(ind.toLowerCase())
            );
            if (matchedIndustry) {
              form.setFieldValue('companyIndustry', matchedIndustry);
            }
          }
          setSpinning(false);
          setHideForm(false);
        })
        .catch((err: any) => {
          console.log(err);
          setSpinning(false);
        });
    }
  };

  const getValidationRules = (fieldName: string, isRequired: boolean) => {
    const baseRules = [
      { required: isRequired, message: `Please enter your ${fieldName}` },
    ];

    return baseRules;
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Spin spinning={spinning}>
      <Form
        form={form}
        layout={formLayout}
        name="UserProfile"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        onFieldsChange={onFormValueChanged}
        onFinish={onSubmit}
        autoComplete="off"
        disabled={isLoading || !isSuccess}
      >
        <Form.Item label={t('profile.email')} name="email">
          <Input disabled />
        </Form.Item>
        <Form.Item label={t('profile.name')} required>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item
                name="firstname"
                noStyle
                rules={getValidationRules('first name', requireProfileData)}
              >
                <Input placeholder={t('profile.firstName')} />
              </Form.Item>
            </Col>
            <Col span={12}>
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
          label={t('profile.specialty')}
          name="specialty"
          tooltip={t('profile.specialtyTooltip')}
          rules={getValidationRules('role', requireCompanyData)}
        >
          <Select>
            <Select.Option value={''}>
              {currentLanguage === 'zh' ? '选择角色' : 'Select a role'}
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
          label={t('referral.howDidYouHear')}
          name="referalSource"
          rules={getValidationRules('referral source', requireCompanyData)}
        >
          <Select placeholder={t('referral.selectSource')}>
            <Select.Option value="search_engine">
              {t('referral.searchEngine')}
            </Select.Option>
            <Select.Option value="social_media">
              {t('referral.socialMedia')}
            </Select.Option>
            <Select.Option value="friend">{t('referral.friend')}</Select.Option>
            <Select.Option value="advertisement">
              {t('referral.advertisement')}
            </Select.Option>
            <Select.Option value="other">{t('referral.other')}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label={t('profile.website')}
          name="companyWebsite"
          rules={getValidationRules('website', requireCompanyData)}
        >
          <Input
            // type="url"
            placeholder={t('profile.websitePlaceholder')}
            disabled={isLoading}
            // onInput={debounce(inputHandle, 1000)}
          />
        </Form.Item>
        {!hideForm && (
          <>
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
                <Select.Option value="">
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
          </>
        )}

        {errorMsg && (
          <Form.Item wrapperCol={{ offset: 1, span: 18 }}>
            <Alert type="error" message={errorMsg} />
          </Form.Item>
        )}
        <Form.Item
          wrapperCol={{ offset: 1, span: 24 }}
          style={{ textAlign: 'center' }}
        >
          <Button
            type="primary"
            htmlType="submit"
            disabled={submitDisabled}
            loading={updateProfileMutation.isLoading}
          >
            {t('common.confirm')}
          </Button>
        </Form.Item>
      </Form>
    </Spin>
  );
}
