class RegisterProfileRequest {
  final String fullName;
  final String gender;
  final String collegeName;
  final String rollNumber;

  RegisterProfileRequest({
    required this.fullName,
    required this.gender,
    required this.collegeName,
    required this.rollNumber,
  });

  Map<String, dynamic> toJson() {
    return {
      'fullName': fullName,
      'gender': gender,
      'collegeName': collegeName,
      'rollNumber': rollNumber,
    };
  }
}
