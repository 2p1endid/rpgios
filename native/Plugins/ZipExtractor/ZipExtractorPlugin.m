#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ZipExtractorPlugin, "ZipExtractor",
    CAP_PLUGIN_METHOD(extract, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getExtractedPath, CAPPluginReturnPromise);
)
