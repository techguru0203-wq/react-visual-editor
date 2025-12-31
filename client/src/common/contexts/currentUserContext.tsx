import React, { createContext, useContext, useRef } from 'react';
import { Authenticator, translations } from '@aws-amplify/ui-react';
import { Organization, RecordStatus } from '@prisma/client';
import { Typography } from 'antd';
import { Amplify } from 'aws-amplify';
import { AuthUser, signUp } from 'aws-amplify/auth';
import { I18n } from 'aws-amplify/utils';
import { useSearchParams } from 'react-router-dom';

import { LoadingScreen } from '../../containers/layout/components/LoadingScreen';
import { HomePath } from '../../containers/nav/paths';
import useUserProfileQuery from '../../containers/profile/hooks/useUserProfileQuery';
import { createNewUserApi } from '../../containers/user/api/createNewUserApi';
import { api_url } from '../../lib/constants';
import trackEvent from '../../trackingClient';
import { ComponentProps, UserInfo } from '../types/common';
import { getHeaders } from '../util/apiHeaders';
import { LanguageProvider, useLanguageWithFallback } from './languageContext';

import '@aws-amplify/ui-react/styles.css';
import './authenticator.scss';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID as string,
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID as string,
      signUpVerificationMethod: 'link',
      loginWith: {
        email: true,
        oauth: {
          domain: process.env.REACT_APP_COGNITO_DOMAIN as string,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [
            process.env.REACT_APP_COGNITO_REDIRECT_SIGNIN as string,
          ],
          redirectSignOut: [
            process.env.REACT_APP_COGNITO_REDIRECT_SIGNOUT as string,
          ],
          responseType: 'code',
        },
      },
    },
  },
});

type CurrentUserContextType = Readonly<{
  user: UserInfo;
  hasProfile: boolean;
  isAdmin: boolean;
  signOut: () => void;
  subscriptionStatus: string;
  subscriptionTier: string;
  organization: Partial<Organization>;
  isReferralEnabled: boolean;
}>;

const UserContext = createContext<CurrentUserContextType | undefined>(
  undefined
);

export function useCurrentUser(): CurrentUserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('Current user context is not available');
  }
  return context;
}

// Safe version of useCurrentUser that doesn't throw error when context is not available
export function useCurrentUserSafe(): CurrentUserContextType | null {
  const context = useContext(UserContext);
  return context || null;
}

function UserProfileProvider({
  user,
  signOut,
  children,
}: ComponentProps & { user?: AuthUser; signOut?: () => void }) {
  const { t } = useLanguageWithFallback();
  if (!user?.userId) {
    throw new Error('User Id is not available');
  }
  const {
    data: userProfile,
    isLoading,
    isError,
    isSuccess,
    error,
  } = useUserProfileQuery(user?.userId, Boolean(user));

  const isGoogleOAuthSignUpTracked = useRef(false);
  const isUserLoginTracked = useRef(false);
  const isReferralProcessed = useRef(false);

  // Sync language with user profile when user is available
  React.useEffect(() => {
    if (userProfile && userProfile.meta) {
      const meta = userProfile.meta as any;
      const userLanguage = meta.language as 'en' | 'zh';
      if (userLanguage && (userLanguage === 'en' || userLanguage === 'zh')) {
        // Update localStorage to sync with user profile
        localStorage.setItem('preferredLanguage', userLanguage);
      }
    }
  }, [userProfile]);

  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  let referralCode = searchParams.get('ref');

  if (!user || !signOut || isLoading || !userProfile?.id) {
    return <LoadingScreen />;
  }

  if (isError || !isSuccess) {
    return (
      <div>
        {t('common.errorLoadingProfile').replace(
          '{error}',
          (error || 'unknown').toString()
        )}
      </div>
    );
  }

  // set up intercom
  // Intercom({
  //   app_id: 'gxyaxpes',
  //   user_id: userProfile.id,
  //   user_hash: createIntercomHmac(userProfile.id),
  // });

  // track user sign up with google oauth
  if (code && !isGoogleOAuthSignUpTracked.current) {
    console.log('google oauth code:', code);
    // tracking google oauth sign up
    trackEvent('signup', {
      distinct_id: userProfile.email,
      payload: JSON.stringify({
        source: 'google_oauth',
        userId: userProfile.id,
      }),
    });
    isGoogleOAuthSignUpTracked.current = true;
  }
  // track user login
  if (!isUserLoginTracked.current) {
    // console.log('User login:', userProfile.email);

    // Determine login source more reliably
    let loginSource = 'email_login'; // default

    // Check if we have a code parameter (Google OAuth callback)
    if (code) {
      loginSource = 'google_oauth';
    } else {
      // Check if user was redirected from Google OAuth (check referrer or other indicators)
      const referrer = document.referrer;
      const isGoogleOAuth =
        referrer.includes('google.com') ||
        // Check if we have Google OAuth related data in localStorage
        localStorage.getItem('googleOAuthLogin') === 'true';

      if (isGoogleOAuth) {
        loginSource = 'google_oauth';
        // Clean up the temporary flag
        localStorage.removeItem('googleOAuthLogin');
      }
    }

    // Save login method to localStorage for next time
    localStorage.setItem('lastLoginMethod', loginSource);

    // tracking google oauth sign up
    trackEvent('login', {
      distinct_id: userProfile.email,
      name: userProfile.firstname + ' ' + userProfile.lastname,
      email: userProfile.email,
      source: loginSource,
      userId: userProfile.id,
    });
    isUserLoginTracked.current = true;
  }

  // Handle referral processing for both URL params and localStorage (for Google OAuth redirects)
  const processReferral = async (referralCodeToProcess: string) => {
    if (!isReferralProcessed.current && userProfile.id) {
      isReferralProcessed.current = true;

      // Process referral asynchronously (don't block UI)
      try {
        console.log(
          'Processing referral for user:',
          userProfile.email,
          'with code:',
          referralCodeToProcess
        );

        const response = await fetch(`${api_url}/api/referral/process`, {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify({
            referrerCode: referralCodeToProcess,
            newUserId: userProfile.id,
            newUserEmail: userProfile.email,
          }),
        });

        if (response.ok) {
          console.log(
            'Referral processed successfully for user:',
            userProfile.email
          );
        } else {
          console.error(
            'Failed to process referral for user:',
            userProfile.email
          );
        }
      } catch (error) {
        console.error(
          'Error processing referral for user:',
          userProfile.email,
          error
        );
      }
    }
  };

  // Check for referral code in URL params first, then localStorage
  if (!referralCode) {
    referralCode = localStorage.getItem('pendingReferralCode');
  }

  // Process referral if we have a code and haven't processed it yet
  if (referralCode && !isReferralProcessed.current) {
    console.log('Processing referral with code:', referralCode);
    processReferral(referralCode);

    // Clean up localStorage after processing
    localStorage.removeItem('pendingReferralCode');
    console.log('Cleaned up referral code from localStorage');
  }

  // redirect to home page if user is logged in and route is /signin or /signup
  const { pathname } = window.location;
  if (pathname === '/signup' || pathname === '/signin') {
    window.location.href = `/${HomePath}`;
    return;
  }

  const pendingStatus =
    userProfile && userProfile.status === RecordStatus.PENDING;
  const currentUserContext: CurrentUserContextType = {
    user: {
      id: user.userId,
      username: userProfile.username,
      email: userProfile.email,
      status: userProfile.status,
      firstname: userProfile.firstname,
      lastname: userProfile.lastname,
      specialty: userProfile.specialty || '',
      role: userProfile.role || 'EMPLOYEE',
      referralCode: userProfile.referralCode || null,
    },
    hasProfile: userProfile && !pendingStatus,
    isAdmin: userProfile?.isAdmin || false,
    signOut,
    subscriptionStatus: userProfile.subscriptionStatus,
    subscriptionTier: userProfile.subscriptionTier,
    organization: userProfile.organization || {},
    isReferralEnabled: userProfile.isReferralEnabled || false,
  };
  // console.log('Using new user context', currentUserContext);
  return (
    <UserContext.Provider value={currentUserContext}>
      {children}
    </UserContext.Provider>
  );
}

function LoginHeader() {
  // Get translation function (will automatically use localStorage language)
  const { t } = useLanguageWithFallback();

  React.useEffect(() => {
    // Get the last login method from localStorage
    const method = localStorage.getItem('lastLoginMethod');

    // Only show tag if user has actually logged in before (not a brand new user)
    const hasLoggedInBefore =
      method === 'google_oauth' || method === 'email_login';

    if (!hasLoggedInBefore) return;

    // Add click listeners to Google login button to set OAuth flag
    const addGoogleOAuthListener = () => {
      const authenticator = document.querySelector(
        '[data-amplify-authenticator]'
      );
      if (!authenticator) return;

      const googleButton =
        authenticator.querySelector(
          'button[data-amplify-signin-button="google"]'
        ) ||
        authenticator.querySelector('button[data-amplify-signin-button]') ||
        authenticator.querySelector('button[type="button"]');

      if (googleButton) {
        googleButton.addEventListener('click', () => {
          localStorage.setItem('googleOAuthLogin', 'true');
        });
      }
    };

    // Try to add listener immediately and on DOM changes
    addGoogleOAuthListener();

    const addLastUsedTag = (button: Element) => {
      // Remove existing tag if any
      const existingTag = button.querySelector('.last-used-tag');
      if (existingTag) existingTag.remove();

      // Add new tag
      const tag = document.createElement('div');
      tag.className = 'last-used-tag';
      tag.textContent = 'Last used';
      (button as HTMLElement).style.position = 'relative';
      button.appendChild(tag);
    };

    // Wait for the DOM to be ready, then add the tag to the appropriate button
    const addTagToButton = () => {
      const authenticator = document.querySelector(
        '[data-amplify-authenticator]'
      );
      if (!authenticator) return;

      // Check for Sign In tab indicators
      const isSignInTab =
        authenticator.textContent?.includes('Sign in') ||
        authenticator.textContent?.includes('Sign in to your account') ||
        authenticator.textContent?.includes("Don't have an account?") ||
        authenticator.textContent?.includes('Forgot your password?');

      // Only proceed if we're on the Sign In tab
      if (!isSignInTab) {
        return;
      }

      // Find the Google button
      const googleButton =
        authenticator.querySelector(
          'button[data-amplify-signin-button="google"]'
        ) ||
        authenticator.querySelector('button[data-amplify-signin-button]') ||
        authenticator.querySelector('button[type="button"]');

      if (googleButton && method === 'google_oauth') {
        addLastUsedTag(googleButton);
      }

      // Find the email/password button (usually the primary button)
      const emailButton =
        authenticator.querySelector('button[type="submit"]') ||
        authenticator.querySelector(
          'button[data-amplify-signin-button="email"]'
        );

      if (emailButton && method === 'email_login') {
        addLastUsedTag(emailButton);
      }
    };

    addTagToButton();
    // Set up MutationObserver to reapply tags when DOM changes (e.g., switching tabs between Sign In, Sign Up, and Forgot Password)
    // Only observe in authenticator element
    const authenticator = document.querySelector(
      '[data-amplify-authenticator]'
    );
    if (!authenticator) return;

    const observer = new MutationObserver((mutations) => {
      let shouldReapply = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes are significant (not just text nodes)
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldReapply = true;
            }
          });
        }
      });

      if (shouldReapply) {
        // Small delay to let the new content render
        // Without this, the page will stuck because of MutationObserver and DOM manipulation interact
        setTimeout(() => {
          addTagToButton();
          addGoogleOAuthListener(); // Re-add Google OAuth listener for refresh cases
        }, 100);
      }
    });

    // Observe the authenticator for changes
    observer.observe(authenticator, {
      childList: true,
      subtree: true,
    });

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="login-header">
      <Typography.Title>{t('login.title')}</Typography.Title>
    </div>
  );
}

// Create form fields with translations
function getFormFields(t: (key: string) => string) {
  return {
    signUp: {
      email: {
        order: 1,
        isRequired: true,
        label: t('login.email'),
        placeholder: t('login.emailPlaceholder'),
      },
      password: {
        order: 2,
        isRequired: true,
        label: t('login.password'),
        placeholder: t('login.passwordPlaceholder'),
      },
      confirm_password: {
        order: 3,
        isRequired: true,
        label: t('login.confirmPassword'),
        placeholder: t('login.confirmPasswordPlaceholder'),
      },
      // 'custom:organization_name': {
      //   label: 'Organization Name',
      //   order: 4,
      //   isRequired: true,
      //   placeholder: 'Enter your Organization Name',
      // },
      // 'custom:organization_website': {
      //   order: 5,
      //   label: 'Organization Website',
      //   placeholder: 'Enter your Organization Website (optional)',
      // },
    },
    signIn: {
      username: {
        order: 1,
        isRequired: true,
        label: t('login.email'),
        placeholder: t('login.emailPlaceholder'),
      },
      password: {
        order: 2,
        isRequired: true,
        label: t('login.password'),
        placeholder: t('login.passwordPlaceholder'),
      },
    },
  };
}

export function UserProvider({ children }: ComponentProps) {
  // Get language directly from localStorage for login/signup pages
  const [language, setLanguage] = React.useState<'en' | 'zh'>(() => {
    // Check for lang parameter in URL first (for reviewers)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang') as 'en' | 'zh';

    if (urlLang && (urlLang === 'en' || urlLang === 'zh')) {
      // URL parameter takes precedence for reviewers
      localStorage.setItem('preferredLanguage', urlLang);
      return urlLang;
    }

    // Otherwise, use localStorage preference
    const storedLanguage = localStorage.getItem('preferredLanguage') as
      | 'en'
      | 'zh';
    return storedLanguage === 'zh' || storedLanguage === 'en'
      ? storedLanguage
      : 'en';
  });

  // Listen for language changes from other tabs/windows
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'preferredLanguage' && e.newValue) {
        const newLanguage = e.newValue as 'en' | 'zh';
        if (newLanguage === 'en' || newLanguage === 'zh') {
          setLanguage(newLanguage);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Create translation function
  const { t } = useLanguageWithFallback();

  // Configure AWS Amplify I18n translations
  React.useEffect(() => {
    if (language === 'zh') {
      I18n.setLanguage('zh');
      // Add Chinese translations for Authenticator
      I18n.putVocabularies({
        zh: {
          // Main navigation and buttons
          'Sign In': '登录',
          'Create Account': '创建账户',
          'Sign In with Google': '使用 Google 登录',
          'Sign in': '登录',
          'Sign Up with Google': '使用 Google 注册',
          or: '或',

          // Password reset flow
          'Forgot your password?': '忘记密码？',
          'Reset Password': '重置密码',
          'Enter your email': '输入您的邮箱',
          'Send code': '发送验证码',
          'Back to Sign In': '返回登录',
          'Enter your confirmation code': '输入您的验证码',
          'Enter your new password': '输入您的新密码',
          'Confirm your password': '确认您的密码',
          'We will send a verification code': '我们将发送验证码',
          'Check your email': '检查您的邮箱',
          'Resend code': '重新发送验证码',

          // Form labels and placeholders
          Email: '邮箱',
          Password: '密码',
          'Confirm Password': '确认密码',
          'Enter your password': '输入您的密码',
          'Enter your email address': '输入您的邮箱地址',

          // Account creation and navigation
          'Create a new account': '创建新账户',
          'Have an account?': '已有账户？',
          "Don't have an account?": '没有账户？',
          'Already have an account?': '已有账户？',
          'Sign in to your account': '登录您的账户',

          // Common actions
          Submit: '提交',
          Cancel: '取消',
          Continue: '继续',
          Back: '返回',
          Next: '下一步',
          Previous: '上一步',
          Finish: '完成',
          Skip: '跳过',
          Save: '保存',
          Edit: '编辑',
          Delete: '删除',
          Add: '添加',
          Remove: '移除',
          Search: '搜索',
          Filter: '筛选',
          Sort: '排序',

          // Status messages
          Loading: '加载中',
          Error: '错误',
          Success: '成功',
          Warning: '警告',
          Info: '信息',
          Required: '必填',
          Optional: '可选',

          // Validation messages
          'Invalid email address': '无效的邮箱地址',
          'Password must be at least 8 characters': '密码至少需要8个字符',
          'Passwords do not match': '密码不匹配',
          'Invalid confirmation code': '无效的验证码',
          'User already exists': '用户已存在',
          'User does not exist': '用户不存在',
          'Incorrect username or password': '用户名或密码错误',
          'Too many attempts. Please try again later':
            '尝试次数过多，请稍后再试',
          'Network error': '网络错误',
          'Something went wrong': '出现错误',
          'Please try again': '请重试',

          // Success messages
          'Verification code sent': '验证码已发送',
          'Password reset successful': '密码重置成功',
          'Account created successfully': '账户创建成功',
          'Sign in successful': '登录成功',
          'Sign out successful': '登出成功',
        },
      });
    } else {
      I18n.setLanguage('en');
      I18n.putVocabularies(translations);
    }
  }, [language]);

  const services = {
    async handleSignUp(formData: any) {
      let { username, password, options } = formData;
      const newUserEmail =
        options?.userAttributes?.email?.toLowerCase() || username;
      const organizationName =
        options?.userAttributes['custom:organization_name'];
      const organizationWebsite =
        options?.userAttributes['custom:organization_website']?.toLowerCase();

      // Extract referral code from URL if present and save to localStorage for Google OAuth
      const urlParams = new URLSearchParams(window.location.search);
      const referralCode = urlParams.get('ref');

      const signedUpUser = await signUp({
        username,
        password,
        options: {
          userAttributes: {},
          autoSignIn: true,
        },
      });

      const newUserId = signedUpUser.userId;

      await createNewUserApi({
        newUserId: newUserId!,
        email: newUserEmail,
        organizationName: organizationName,
        organizationWebsite: organizationWebsite,
        referralCode: referralCode || undefined, // Convert null to undefined
      });

      trackEvent('signup', {
        distinct_id: newUserEmail,
        payload: JSON.stringify({
          userId: newUserId,
          source: 'email_signup',
          referralCode: referralCode || undefined,
        }),
      });
      return signedUpUser;
    },
  };
  const { pathname } = window.location;
  // console.log('UserProvider.pathname:', pathname);

  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  const signupSource = searchParams.get('source');

  // Save referral code to localStorage if present (for Google OAuth redirects)
  if (referralCode) {
    console.log(
      'Saving referral code to localStorage for Google OAuth:',
      referralCode
    );
    localStorage.setItem('pendingReferralCode', referralCode);
  }

  // Save signup source to localStorage if present (for pricing redirects)
  if (signupSource === 'pricing' && pathname === '/signup') {
    console.log('Saving signupFrom=pricing to localStorage');
    localStorage.setItem('signupFrom', 'pricing');
  }

  return (
    <LanguageProvider>
      <Authenticator
        initialState={pathname === '/signup' ? 'signUp' : 'signIn'}
        className="login-screen"
        socialProviders={['google']}
        formFields={getFormFields(t)}
        services={services}
        components={{
          Header: LoginHeader,
        }}
      >
        {({ signOut, user }) => (
          <UserProfileProvider user={user} signOut={signOut}>
            {children}
          </UserProfileProvider>
        )}
      </Authenticator>
    </LanguageProvider>
  );
}
