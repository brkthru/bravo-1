import { Router, Request, Response } from 'express';
import { UserModel, UserRole } from '../models/User';

const router = Router();
const userModel = new UserModel();

// GET /api/users - List all users with optional filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { role, department, managerId, search, isActive } = req.query;

    if (search) {
      const users = await userModel.search(search as string);
      return res.json({ success: true, data: users });
    }

    const filters: any = {};
    if (role) filters.role = role as UserRole;
    if (department) filters.department = department as string;
    if (managerId) filters.managerId = managerId as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const users = await userModel.findAll(filters);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/users/hierarchy - Get organizational hierarchy
router.get('/hierarchy', async (req: Request, res: Response) => {
  try {
    const hierarchy = await userModel.getHierarchy();
    res.json({ success: true, data: hierarchy });
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hierarchy',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/users/:id - Get a specific user
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/users - Create a new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await userModel.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/users/:id - Update a user
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userModel.update(id, req.body);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await userModel.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
