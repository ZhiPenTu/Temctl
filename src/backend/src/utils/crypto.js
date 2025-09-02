const crypto = require('crypto');
const config = require('../config/config');
const logger = require('./logger');
const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * 加密解密工具类
 * 提供安全的数据加密存储和处理功能
 */
class CryptoUtil {
  constructor() {
    this.algorithm = config.crypto.algorithm || 'aes-256-gcm';
    this.keyLength = config.crypto.keyLength || 32;
    this.ivLength = config.crypto.ivLength || 16;
    this.tagLength = config.crypto.tagLength || 16;
    this.saltLength = config.crypto.saltLength || 32;
    
    // 初始化主密码管理
    this.initMasterPassword();
  }

  /**
   * 初始化主密码
   */
  async initMasterPassword() {
    try {
      const masterKeyPath = path.join(os.homedir(), '.temctl', 'master.key');
      
      // 确保目录存在
      const dir = path.dirname(masterKeyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      
      if (!fs.existsSync(masterKeyPath)) {
        // 生成新的主密码
        this.masterKey = this.generateMasterKey();
        
        // 保存主密码（加密存储）
        const encryptedMasterKey = this.encryptMasterKey(this.masterKey);
        fs.writeFileSync(masterKeyPath, encryptedMasterKey, { mode: 0o600 });
        
        logger.database('新主密码已生成并保存');
      } else {
        // 加载存在的主密码
        const encryptedMasterKey = fs.readFileSync(masterKeyPath);
        this.masterKey = this.decryptMasterKey(encryptedMasterKey);
        
        logger.database('主密码已加载');
      }
    } catch (error) {
      logger.error('初始化主密码失败:', error);
      // 如果加载失败，使用临时主密码
      this.masterKey = this.generateMasterKey();
    }
  }

  /**
   * 生成主密码
   */
  generateMasterKey() {
    // 基于系统信息和随机数生成主密码
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      user: os.userInfo().username,
      random: crypto.randomBytes(32).toString('hex')
    };
    
    const systemString = JSON.stringify(systemInfo);
    return crypto.createHash('sha256').update(systemString).digest();
  }

  /**
   * 加密主密码用于存储
   */
  encryptMasterKey(masterKey) {
    // 使用系统特定信息作为加密密钥
    const keyDerivation = crypto.createHash('sha256')
      .update(os.hostname() + os.userInfo().username + 'temctl-master')
      .digest();
    
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyDerivation, iv);
    
    let encrypted = cipher.update(masterKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * 解密主密码
   */
  decryptMasterKey(encryptedData) {
    const keyDerivation = crypto.createHash('sha256')
      .update(os.hostname() + os.userInfo().username + 'temctl-master')
      .digest();
    
    const iv = encryptedData.slice(0, this.ivLength);
    const encrypted = encryptedData.slice(this.ivLength);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyDerivation, iv);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  /**
   * 从密码派生密钥
   */
  deriveKeyFromPassword(password) {
    return crypto.createHash('sha256').update(password).digest();
  }

  /**
   * 生成密钥
   */
  generateKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * 生成随机盐
   */
  generateSalt() {
    return crypto.randomBytes(this.saltLength);
  }

  /**
   * 生成随机IV
   */
  generateIV() {
    return crypto.randomBytes(this.ivLength);
  }

  /**
   * 加密数据
   */
  encrypt(text, password = null) {
    try {
      const key = password ? this.deriveKeyFromPassword(password) : this.masterKey;
      const salt = this.generateSalt();
      const iv = this.generateIV();
      const derivedKey = this.generateKey(key, salt);
      
      const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
      
      let encrypted = cipher.update(text, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // 合并 salt + iv + encrypted
      const result = Buffer.concat([salt, iv, encrypted]);
      
      return result.toString('base64');
    } catch (error) {
      logger.error('加密失败:', error);
      throw new Error('加密失败');
    }
  }

  /**
   * 解密数据
   */
  decrypt(encryptedData, password = null) {
    try {
      const key = password ? this.deriveKeyFromPassword(password) : this.masterKey;
      const data = Buffer.from(encryptedData, 'base64');
      
      // 提取组件
      const salt = data.slice(0, this.saltLength);
      const iv = data.slice(this.saltLength, this.saltLength + this.ivLength);
      const encrypted = data.slice(this.saltLength + this.ivLength);
      
      const derivedKey = this.generateKey(key, salt);
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('解密失败:', error);
      throw new Error('解密失败');
    }
  }

  /**
   * 生成哈希值
   */
  hash(data, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * 生成HMAC
   */
  hmac(data, key, algorithm = 'sha256') {
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
  }

  /**
   * 生成随机字符串
   */
  generateRandomString(length = 32) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  }

  /**
   * 加密认证信息
   */
  async encryptAuthInfo(authInfo) {
    try {
      const authData = JSON.stringify(authInfo);
      const encrypted = this.encrypt(authData);
      
      return {
        encrypted: true,
        data: encrypted,
        algorithm: this.algorithm,
        version: '1.0'
      };
    } catch (error) {
      logger.error('加密认证信息失败:', error);
      throw error;
    }
  }

  /**
   * 解密认证信息
   */
  async decryptAuthInfo(encryptedAuthInfo) {
    try {
      if (!encryptedAuthInfo.encrypted) {
        return encryptedAuthInfo;
      }
      
      const decrypted = this.decrypt(encryptedAuthInfo.data);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('解密认证信息失败:', error);
      throw error;
    }
  }

  /**
   * 加密密码存储
   */
  async encryptPassword(password) {
    try {
      return this.encrypt(password);
    } catch (error) {
      logger.error('加密密码失败:', error);
      throw error;
    }
  }

  /**
   * 解密密码
   */
  async decryptPassword(encryptedPassword) {
    try {
      return this.decrypt(encryptedPassword);
    } catch (error) {
      logger.error('解密密码失败:', error);
      throw error;
    }
  }

  /**
   * 验证文件完整性
   */
  async verifyFileIntegrity(filePath, expectedHash) {
    try {
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);
      const actualHash = this.hash(fileBuffer);
      
      return actualHash === expectedHash;
    } catch (error) {
      logger.error('验证文件完整性失败:', error);
      return false;
    }
  }

  /**
   * 计算文件哈希
   */
  async calculateFileHash(filePath, algorithm = 'sha256') {
    try {
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);
      return this.hash(fileBuffer, algorithm);
    } catch (error) {
      logger.error('计算文件哈希失败:', error);
      throw error;
    }
  }

  /**
   * 生成密钥对 (RSA)
   */
  generateKeyPair(keySize = 2048) {
    try {
      return crypto.generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
    } catch (error) {
      logger.error('生成密钥对失败:', error);
      throw error;
    }
  }

  /**
   * RSA加密
   */
  rsaEncrypt(data, publicKey) {
    try {
      return crypto.publicEncrypt(publicKey, Buffer.from(data)).toString('base64');
    } catch (error) {
      logger.error('RSA加密失败:', error);
      throw error;
    }
  }

  /**
   * RSA解密
   */
  rsaDecrypt(encryptedData, privateKey) {
    try {
      const encrypted = Buffer.from(encryptedData, 'base64');
      return crypto.privateDecrypt(privateKey, encrypted).toString('utf8');
    } catch (error) {
      logger.error('RSA解密失败:', error);
      throw error;
    }
  }

  /**
   * 数字签名
   */
  sign(data, privateKey, algorithm = 'sha256') {
    try {
      const sign = crypto.createSign(algorithm);
      sign.update(data);
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      logger.error('数字签名失败:', error);
      throw error;
    }
  }

  /**
   * 验证签名
   */
  verify(data, signature, publicKey, algorithm = 'sha256') {
    try {
      const verify = crypto.createVerify(algorithm);
      verify.update(data);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      logger.error('验证签名失败:', error);
      return false;
    }
  }
}

// 创建全局加密工具实例
const cryptoUtil = new CryptoUtil();

module.exports = cryptoUtil;