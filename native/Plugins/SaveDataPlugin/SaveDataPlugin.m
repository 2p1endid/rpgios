#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SaveDataPlugin, "SaveData",
    CAP_PLUGIN_METHOD(save, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(load, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(listSlots, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(deleteSave, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(deleteAllForGame, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(exportSaves, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(importSaves, CAPPluginReturnPromise);
)
