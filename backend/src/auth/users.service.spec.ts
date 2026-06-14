import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';

describe('UsersService', () => {
  let service: UsersService;
  let dbPrepareMock: jest.Mock;
  let dbRunMock: jest.Mock;
  let dbGetMock: jest.Mock;

  beforeEach(async () => {
    dbRunMock = jest.fn().mockResolvedValue(undefined);
    dbGetMock = jest.fn().mockResolvedValue(undefined);
    dbPrepareMock = jest.fn().mockReturnValue({
      get: dbGetMock,
      run: dbRunMock,
      all: jest.fn(),
    });

    const mockDatabaseService = {
      connection: {
        prepare: dbPrepareMock,
      },
      now: () => new Date().toISOString(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('hashPassword (via createUser)', () => {
    it('should create a user with hashed password', async () => {
      dbGetMock.mockResolvedValueOnce(undefined); // no existing user (username check)
      dbGetMock.mockResolvedValueOnce({ total: 0 }); // user count query
      dbRunMock.mockResolvedValueOnce(undefined); // insert

      const result = await service.createUser('TestUser', 'Passw0rd!');

      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.role).toBe('admin'); // first user becomes admin
      expect(result.credits).toBeGreaterThan(0);
      expect(result.totalSpent).toBe(0);
      expect(dbPrepareMock).toHaveBeenCalledTimes(4); // check username + count + invitation code + insert
    });
  });

  describe('validateUser', () => {
    it('should return null if user not found', async () => {
      dbGetMock.mockResolvedValueOnce(undefined);

      const result = await service.validateUser('nobody', 'any');

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      dbGetMock.mockResolvedValueOnce({
        id: 'u1',
        username: 'a',
        role: 'user',
        passwordHash: 'wronghash',
        salt: 'abcd1234',
        credits: 10,
        totalSpent: 0,
        createdAt: '2025-01-01',
      });

      const result = await service.validateUser('a', 'badpassword');

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('should throw NotFoundException if user missing', async () => {
      dbGetMock.mockResolvedValueOnce(undefined);

      await expect(service.getById('missing')).rejects.toThrow('用户不存在');
    });
  });
});
