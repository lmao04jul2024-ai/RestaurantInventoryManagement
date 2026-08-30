jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));

import api from '@/lib/api';
import { userService } from '@/services/user.service';

const apiGet = api.get as jest.Mock;
const apiPatch = api.patch as jest.Mock;

describe('userService — Week 11.6 profile endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches the current profile via GET /users/me', async () => {
    apiGet.mockResolvedValue({
      data: { data: { id: 'u1', email: 'c@x.io', firstName: 'Ada', lastName: 'Lovelace' } },
    });

    const user = await userService.getMyProfile();

    expect(apiGet).toHaveBeenCalledWith('/users/me');
    expect(user.firstName).toBe('Ada');
  });

  it('patches names/phone via PATCH /users/me', async () => {
    apiPatch.mockResolvedValue({
      data: { data: { id: 'u1', firstName: 'Ada', lastName: 'King', phone: '+15550001111' } },
    });

    const user = await userService.updateMyProfile({
      firstName: 'Ada',
      lastName: 'King',
      phone: '+15550001111',
    });

    expect(apiPatch).toHaveBeenCalledWith('/users/me', {
      firstName: 'Ada',
      lastName: 'King',
      phone: '+15550001111',
    });
    expect(user.lastName).toBe('King');
  });

  it('sends null to clear the phone number', async () => {
    apiPatch.mockResolvedValue({ data: { data: { id: 'u1', phone: null } } });

    await userService.updateMyProfile({ phone: null });

    expect(apiPatch).toHaveBeenCalledWith('/users/me', { phone: null });
  });
});
