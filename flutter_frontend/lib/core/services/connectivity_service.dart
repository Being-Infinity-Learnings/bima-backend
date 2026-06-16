/// Connectivity service that checks for internet access.
///
/// Uses dart:io InternetAddress to do a real DNS lookup rather than
/// just checking if a network interface is up (which can lie in Flutter).
import 'dart:io';

class ConnectivityService {
  /// Returns true if the device can reach the internet.
  static Future<bool> hasInternet() async {
    try {
      final result = await InternetAddress.lookup(
        'google.com',
      ).timeout(const Duration(seconds: 5));
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
}
