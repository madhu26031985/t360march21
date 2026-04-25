const { withAppBuildGradle } = require('@expo/config-plugins');

const SNIPPET = `
afterEvaluate {
    tasks.matching { it.name == "createBundleReleaseJsAndAssets" }.configureEach {
        dependsOn("compileReleaseAidl", "generateReleaseBuildConfig", "javaPreCompileRelease")
    }
}
`;

module.exports = function withBundleHermesTaskDeps(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    const contents = config.modResults.contents;
    if (contents.includes('createBundleReleaseJsAndAssets') && contents.includes('javaPreCompileRelease')) {
      return config;
    }

    const anchor = 'applyNativeModulesAppBuildGradle(project)';
    if (contents.includes(anchor)) {
      config.modResults.contents = contents.replace(anchor, `${SNIPPET}\n${anchor}`);
    } else {
      config.modResults.contents = `${contents}\n${SNIPPET}\n`;
    }

    return config;
  });
};
