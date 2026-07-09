import { Request, Response } from 'express';
import { ProductService } from './ProductService';
import { getParam } from '../../shared/utils/params';
import { CategoryService } from './CategoryService';

export class ProductController {
  static async list(req: Request, res: Response): Promise<void> {
    const result = await ProductService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async findById(req: Request, res: Response): Promise<void> {
    const result = await ProductService.findById(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const result = await ProductService.create(req.body);
    res.status(201).json({ success: true, data: result });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const result = await ProductService.update(getParam(req, 'id'), req.body, req.user!.id);
    res.json({ success: true, data: result });
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const result = await ProductService.delete(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async createBatch(req: Request, res: Response): Promise<void> {
    const result = await ProductService.createBatch(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }

  static async globalSearch(req: Request, res: Response): Promise<void> {
    const result = await ProductService.globalSearch(req.query.q as string || '');
    res.json({ success: true, data: result });
  }

  static async listCategories(req: Request, res: Response): Promise<void> {
    const result = await CategoryService.list(req.query as Record<string, string>);
    res.json({ success: true, data: result });
  }

  static async findCategory(req: Request, res: Response): Promise<void> {
    const result = await CategoryService.findById(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async createCategory(req: Request, res: Response): Promise<void> {
    const result = await CategoryService.create(req.body);
    res.status(201).json({ success: true, data: result });
  }

  static async updateCategory(req: Request, res: Response): Promise<void> {
    const result = await CategoryService.update(getParam(req, 'id'), req.body);
    res.json({ success: true, data: result });
  }

  static async deleteCategory(req: Request, res: Response): Promise<void> {
    const result = await CategoryService.delete(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async checkCategoryDelete(req: Request, res: Response): Promise<void> {
    const result = await CategoryService.getDeleteCheck(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }
}
