#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <Security/Security.h>
#import <CommonCrypto/CommonDigest.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"TempoMobile";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end

@interface TempoDevice : NSObject<RCTBridgeModule>
@end
@implementation TempoDevice
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
RCT_EXPORT_METHOD(createPkce:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  unsigned char random[32];
  if (SecRandomCopyBytes(kSecRandomDefault, sizeof(random), random) != errSecSuccess) { reject(@"CRYPTO_FAILED", @"Could not start secure sign-in.", nil); return; }
  NSString *(^encode)(NSData *) = ^NSString *(NSData *data) { return [[[[data base64EncodedStringWithOptions:0] stringByReplacingOccurrencesOfString:@"+" withString:@"-"] stringByReplacingOccurrencesOfString:@"/" withString:@"_"] stringByReplacingOccurrencesOfString:@"=" withString:@""]; };
  NSString *verifier = encode([NSData dataWithBytes:random length:sizeof(random)]);
  NSData *input = [verifier dataUsingEncoding:NSUTF8StringEncoding];
  unsigned char hash[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(input.bytes, (CC_LONG)input.length, hash);
  NSString *challenge = encode([NSData dataWithBytes:hash length:sizeof(hash)]);
  NSString *flow = [[[[NSUUID UUID] UUIDString] stringByReplacingOccurrencesOfString:@"-" withString:@""] lowercaseString];
  resolve(@{@"verifier":verifier, @"challenge":challenge, @"flow":flow});
}
RCT_EXPORT_METHOD(saveFile:(NSString *)name mime:(NSString *)mime content:(NSString *)content resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([content lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > 5000000) { reject(@"TOO_LARGE", @"The export is too large.", nil); return; }
  NSString *safeName = [name lastPathComponent];
  NSString *directory = [NSTemporaryDirectory() stringByAppendingPathComponent:[[NSUUID UUID] UUIDString]];
  NSError *error = nil;
  [[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:&error];
  NSURL *file = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:safeName.length ? safeName : @"tempo-calendar.ics"]];
  if (![content writeToURL:file atomically:YES encoding:NSUTF8StringEncoding error:&error]) { reject(@"SAVE_FAILED", @"Could not prepare the export.", error); return; }
  UIViewController *presenter = RCTPresentedViewController();
  if (!presenter) { reject(@"NO_ACTIVITY", @"Open Tempo to save this file.", nil); return; }
  UIActivityViewController *share = [[UIActivityViewController alloc] initWithActivityItems:@[file] applicationActivities:nil];
  share.popoverPresentationController.sourceView = presenter.view;
  share.popoverPresentationController.sourceRect = CGRectMake(CGRectGetMidX(presenter.view.bounds), CGRectGetMidY(presenter.view.bounds), 1, 1);
  share.completionWithItemsHandler = ^(UIActivityType type, BOOL completed, NSArray *items, NSError *activityError) {
    [[NSFileManager defaultManager] removeItemAtPath:directory error:nil];
    if (activityError) reject(@"SAVE_FAILED", @"Export did not finish.", activityError); else resolve(@(completed));
  };
  [presenter presentViewController:share animated:YES completion:nil];
}
RCT_EXPORT_METHOD(print:(NSString *)html baseURL:(NSString *)baseURL resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([html lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > 5000000) { reject(@"TOO_LARGE", @"The print document is too large.", nil); return; }
  UIPrintInteractionController *printer = [UIPrintInteractionController sharedPrintController];
  UIPrintInfo *info = [UIPrintInfo printInfo];
  info.jobName = @"Tempo calendar";
  info.outputType = UIPrintInfoOutputGeneral;
  printer.printInfo = info;
  printer.printFormatter = [[UIMarkupTextPrintFormatter alloc] initWithMarkupText:html];
  [printer presentAnimated:YES completionHandler:^(UIPrintInteractionController *controller, BOOL completed, NSError *error) {
    if (error) reject(@"PRINT_FAILED", @"Printing did not finish.", error); else resolve(nil);
  }];
}
@end
