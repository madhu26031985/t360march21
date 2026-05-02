const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const WIDGET_PROVIDER_NAME = '.T360MeetingWidgetProvider';
const WIDGET_XML_NAME = 't360_meeting_widget_info';

function ensureFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function withWidgetManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const receivers = mainApplication.receiver || [];
    const alreadyAdded = receivers.some((receiver) => receiver?.$?.['android:name'] === WIDGET_PROVIDER_NAME);

    if (!alreadyAdded) {
      receivers.push({
        $: {
          'android:name': WIDGET_PROVIDER_NAME,
          // Must be exported so Android launcher can discover/update AppWidgetProvider.
          'android:exported': 'true',
          // Same strings file as dangerous-mod (generated before manifest merge in practice — both land in android/).
          'android:label': '@string/t360_open_meeting_widget_label',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': `@xml/${WIDGET_XML_NAME}`,
            },
          },
        ],
      });
    }

    mainApplication.receiver = receivers;
    return config;
  });
}

function withWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = path.join(projectRoot, 'android');
      const packageName = config.android?.package;

      if (!packageName) {
        throw new Error('Android package name is required to generate widget files.');
      }

      const packagePath = packageName.split('.').join('/');
      const javaFile = path.join(androidRoot, 'app/src/main/java', packagePath, 'T360MeetingWidgetProvider.java');
      const layoutFile = path.join(androidRoot, 'app/src/main/res/layout', 't360_meeting_widget.xml');
      const widgetInfoFile = path.join(androidRoot, 'app/src/main/res/xml', `${WIDGET_XML_NAME}.xml`);
      const widgetStringsFile = path.join(androidRoot, 'app/src/main/res/values', 't360_widget_strings.xml');
      const backgroundFile = path.join(androidRoot, 'app/src/main/res/drawable', 't360_widget_bg.xml');

      ensureFile(
        javaFile,
        `package ${packageName};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class T360MeetingWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.t360_meeting_widget);

      views.setImageViewResource(R.id.widget_logo, R.mipmap.ic_launcher);
      views.setTextViewText(R.id.widget_club_name, "T360 Toastmasters Club");
      views.setTextViewText(R.id.widget_meeting_title, "Open meeting");
      views.setTextViewText(R.id.widget_meeting_meta, "Meeting #128 • in 2 days");
      views.setTextViewText(
        R.id.widget_roles_scroller,
        "Sureshkumar booked TMOD • Guru booked Prepared Speaker • Priya booked General Evaluator"
      );
      views.setTextViewText(
        R.id.widget_details_scroller,
        "Theme: Growth Mindset • Edu Speech: Speak with Impact • Word: Resilience • Quote: Start where you are • Idiom: Break the ice • Agenda is live"
      );

      views.setBoolean(R.id.widget_roles_scroller, "setSelected", true);
      views.setBoolean(R.id.widget_details_scroller, "setSelected", true);

      views.setOnClickPendingIntent(R.id.widget_btn_book, buildDeepLinkIntent(context, "toastmaster360://book-a-role"));
      views.setOnClickPendingIntent(R.id.widget_root, buildDeepLinkIntent(context, "toastmaster360://meetings"));

      appWidgetManager.updateAppWidget(appWidgetId, views);
    }
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    if (intent != null && AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(intent.getAction())) {
      AppWidgetManager manager = AppWidgetManager.getInstance(context);
      int[] ids = manager.getAppWidgetIds(new ComponentName(context, T360MeetingWidgetProvider.class));
      onUpdate(context, manager, ids);
    }
  }

  private PendingIntent buildDeepLinkIntent(Context context, String uri) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
    intent.setPackage(context.getPackageName());

    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }

    return PendingIntent.getActivity(context, uri.hashCode(), intent, flags);
  }
}
`
      );

      ensureFile(
        layoutFile,
        `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:padding="12dp"
  android:background="@drawable/t360_widget_bg">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">
    <ImageView
      android:id="@+id/widget_logo"
      android:layout_width="26dp"
      android:layout_height="26dp"
      android:contentDescription="T360 logo" />
    <TextView
      android:id="@+id/widget_club_name"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:layout_marginStart="8dp"
      android:text="T360 Toastmasters Club"
      android:textStyle="bold"
      android:textSize="14sp"
      android:textColor="#0F172A" />
  </LinearLayout>

  <TextView
    android:id="@+id/widget_meeting_title"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="6dp"
    android:text="Open meeting"
    android:textStyle="bold"
    android:textSize="15sp"
    android:textColor="#111827" />

  <TextView
    android:id="@+id/widget_meeting_meta"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="2dp"
    android:text="Meeting in 2 days"
    android:textSize="12sp"
    android:textColor="#4B5563" />

  <TextView
    android:id="@+id/widget_roles_scroller"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:singleLine="true"
    android:ellipsize="marquee"
    android:marqueeRepeatLimit="marquee_forever"
    android:focusable="true"
    android:focusableInTouchMode="true"
    android:text="TM: Placeholder • GE: Placeholder • Ah-Counter: Placeholder"
    android:textSize="12sp"
    android:textColor="#1F2937" />

  <TextView
    android:id="@+id/widget_details_scroller"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:singleLine="true"
    android:ellipsize="marquee"
    android:marqueeRepeatLimit="marquee_forever"
    android:focusable="true"
    android:focusableInTouchMode="true"
    android:text="Theme: Placeholder • Edu Speech: Placeholder • Word: Placeholder • Quote: Placeholder • Idiom: Placeholder • Agenda is live"
    android:textSize="12sp"
    android:textColor="#334155" />

  <TextView
    android:id="@+id/widget_btn_book"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="10dp"
    android:gravity="center"
    android:paddingHorizontal="10dp"
    android:paddingVertical="8dp"
    android:text="Book now"
    android:textStyle="bold"
    android:textColor="#FFFFFF"
    android:background="#2563EB" />
</LinearLayout>
`
      );

      // Label string only (manifest receiver uses it). Omit android:description on appwidget-provider —
      // raw text breaks AAPT; @string can merge oddly on some CI caches — optional attribute, skip it.
      ensureFile(
        widgetStringsFile,
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="t360_open_meeting_widget_label">T360 Open Meeting</string>
</resources>
`
      );

      ensureFile(
        widgetInfoFile,
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="280dp"
  android:minHeight="120dp"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/t360_meeting_widget"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
`
      );

      ensureFile(
        backgroundFile,
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#FFFFFF" />
  <corners android:radius="16dp" />
  <stroke android:width="1dp" android:color="#E5E7EB" />
</shape>
`
      );

      return config;
    },
  ]);
}

module.exports = function withAndroidHomeWidget(config) {
  config = withWidgetManifest(config);
  config = withWidgetFiles(config);
  return config;
};
