import { Redirect } from 'expo-router';

/** Native: `/weblogin` is only used on web (OAuth + hosted URL). On app builds, send users home. */
export default function WebloginNative() {
  return <Redirect href="/" />;
}
