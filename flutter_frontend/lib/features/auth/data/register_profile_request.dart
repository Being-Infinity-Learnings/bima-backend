/// Request payload used to submit the user's completed profile.
class RegisterProfileRequest {
  final String fullName;
  final String gender;
  final String collegeName;
  final String rollNumber;
  final String email;

  const RegisterProfileRequest({
    required this.fullName,
    required this.gender,
    required this.collegeName,
    required this.rollNumber,
    required this.email,
  });

  /// Converts the profile request into JSON for API consumption.
  Map<String, dynamic> toJson() {
    return {
      'fullName': fullName,
      'gender': gender,
      'collegeName': collegeName,
      'rollNumber': rollNumber,
      'email': email,
    };
  }
}
