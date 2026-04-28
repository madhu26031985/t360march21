const { withAppBuildGradle } = require('@expo/config-plugins');

const SNIPPET = `
afterEvaluate {
    tasks.matching { it.name == "createBundleReleaseJsAndAssets" }.configureEach {
        ["compileReleaseAidl", "generateReleaseBuildConfig", "javaPreCompileRelease"].each { depName ->
            def depTask = tasks.findByName(depName)
            if (depTask != null) {
                dependsOn(depTask)
            }
        }
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
