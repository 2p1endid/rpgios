#import <Capacitor/Capacitor.h>

CAP_PLUGIN(GameServerPlugin, "GameServer",
    CAP_PLUGIN_METHOD(startServer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopServer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isRunning, CAPPluginReturnPromise);
)
