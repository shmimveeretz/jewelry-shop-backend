import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory path
const DATA_DIR = path.join(__dirname, "../../data");

class LocalStorage {
  constructor() {
    this.initializeStorage();
  }

  // Initialize data directory and files
  async initializeStorage() {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(DATA_DIR, { recursive: true });

      // Initialize JSON files if they don't exist
      const files = ["users.json", "products.json", "orders.json"];

      for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        try {
          await fs.access(filePath);
        } catch {
          // File doesn't exist, create it
          await fs.writeFile(filePath, JSON.stringify([], null, 2));
        }
      }
    } catch (error) {
      console.error("Error initializing storage:", error);
    }
  }

  // Read data from JSON file
  async read(collection) {
    try {
      const filePath = path.join(DATA_DIR, `${collection}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${collection}:`, error);
      return [];
    }
  }

  // Write data to JSON file
  async write(collection, data) {
    try {
      const filePath = path.join(DATA_DIR, `${collection}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing ${collection}:`, error);
      throw error;
    }
  }

  // Generate unique ID
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Find by ID
  async findById(collection, id) {
    const data = await this.read(collection);
    return data.find((item) => item.id === id);
  }

  // Find by field
  async findByField(collection, field, value) {
    const data = await this.read(collection);
    return data.find((item) => item[field] === value);
  }

  // Find all by field
  async findAllByField(collection, field, value) {
    const data = await this.read(collection);
    return data.filter((item) => item[field] === value);
  }

  // Get all
  async findAll(collection) {
    return await this.read(collection);
  }

  // Create
  async create(collection, item) {
    const data = await this.read(collection);
    const newItem = {
      id: this.generateId(),
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.push(newItem);
    await this.write(collection, data);
    return newItem;
  }

  // Update
  async update(collection, id, updates) {
    const data = await this.read(collection);
    const index = data.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    data[index] = {
      ...data[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.write(collection, data);
    return data[index];
  }

  // Delete
  async delete(collection, id) {
    const data = await this.read(collection);
    const filteredData = data.filter((item) => item.id !== id);

    if (data.length === filteredData.length) {
      return false; // Item not found
    }

    await this.write(collection, filteredData);
    return true;
  }

  // Custom query (for complex operations)
  async query(collection, filterFn) {
    const data = await this.read(collection);
    return data.filter(filterFn);
  }
}

// Export singleton instance
const localStorage = new LocalStorage();
export default localStorage;
