import { Redirect } from 'expo-router';

/** ExComm guides now live on the main T360 training list; keep route for bookmarks. */
export default function T360TrainingExcommScreen() {
  return <Redirect href="/t360-training" />;
}
