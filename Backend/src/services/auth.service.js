import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { generateToken } from '../utils/jwt.js';

const generateCustomerId = () => `CUST-${Math.floor(100000 + Math.random() * 900000)}`;
const generateEmployeeId = () => `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * AuthService
 * 
 * Manages core user authentication (Signup, Login) and user identity/KYC records.
 * Policy records and underwriting details are handled separately by PolicyDetailService.
 */
class AuthService {
  /**
   * CREATE (Signup): Registers a new user account with core identity fields only.
   */
  async registerUser({ name, email, password, role = 'POLICYHOLDER', department, phone }) {
    if (!name || !email || !password) {
      throw ApiError.badRequest('Name, email, and password are required');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.badRequest('An account with this email already exists');
    }

    const totalUsers = await User.countDocuments();
    // First user becomes COMPANY_ADMIN, otherwise uses requested role (defaults to POLICYHOLDER)
    const assignedRole = totalUsers === 0 ? 'COMPANY_ADMIN' : role;

    const userData = {
      name,
      email,
      password,
      role: assignedRole,
      phone: phone || '',
      department: department || undefined
    };

    if (assignedRole === 'POLICYHOLDER') {
      userData.customerId = generateCustomerId();
    } else {
      userData.employeeId = generateEmployeeId();
    }

    const user = await User.create(userData);
    return { user: this.sanitizeUser(user) };
  }

  /**
   * LOGIN: Validates credentials and issues JWT session token.
   */
  async loginUser({ email, password }) {
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const user = await User.findOne({ email })
      .select('+password')
      .populate('policies.policyId', 'policyNumber policyName insuranceType status');

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Your account is inactive. Please contact support.');
    }

    const token = generateToken({ id: user._id, role: user.role });
    return { user: this.sanitizeUser(user), token };
  }

  /**
   * READ ALL (Get All Users): Retrieves all user identity records with populated policy references.
   */
  async getAllUsers(queryParams = {}) {
    const { role, status, search } = queryParams;
    const query = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'policies.policyName': { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('policies.policyId', 'policyNumber policyName insuranceType status')
      .sort({ createdAt: -1 });

    return users.map((u) => this.sanitizeUser(u));
  }

  /**
   * READ ONE (Get User By ID): Retrieves a single user identity record by ID.
   */
  async getUserById(id) {
    const user = await User.findById(id)
      .select('-password')
      .populate('policies.policyId', 'policyNumber policyName insuranceType status');

    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return this.sanitizeUser(user);
  }

  /**
   * UPDATE (Update User By ID): Updates only core user identity, contact, and KYC consent fields.
   */
  async updateUser(id, updateData) {
    const user = await User.findById(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Only user identity and confidential KYC fields are allowed on User
    const allowedFields = [
      'name',
      'phone',
      'role',
      'status',
      'department',
      'dateOfBirth',
      'age',
      'gender',
      'city',
      'pincode',
      'preferredLanguage',
      'consentDataStore',
      'idProofType',
      'idProofNumber'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    }

    await user.save();
    return await this.getUserById(id);
  }

  sanitizeUser(user) {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    delete obj.__v;
    return obj;
  }
}

export const authService = new AuthService();
