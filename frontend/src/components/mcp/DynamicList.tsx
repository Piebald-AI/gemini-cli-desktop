import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Trash2 } from "lucide-react";

interface DynamicListProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  description?: string;
}

export function DynamicList({ 
  items, 
  onChange, 
  placeholder = "Enter value", 
  description 
}: DynamicListProps) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      {/* Existing items */}
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input 
            value={item}
            onChange={(e) => {
              const newItems = [...items];
              newItems[index] = e.target.value;
              onChange(newItems);
            }}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => handleRemove(index)}
            className="h-10 w-10 text-gray-500 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      {/* Add new item */}
      <div className="flex items-center gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button 
          onClick={handleAdd}
          disabled={!newItem.trim() || items.includes(newItem.trim())}
        >
          Add
        </Button>
      </div>

      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

interface KeyValuePair {
  key: string;
  value: string;
}

interface DynamicKeyValueListProps {
  items: KeyValuePair[];
  onChange: (items: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  description?: string;
}

export function DynamicKeyValueList({
  items,
  onChange,
  keyPlaceholder = "Name",
  valuePlaceholder = "Value",
  description
}: DynamicKeyValueListProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleAdd = () => {
    if (newKey.trim() && newValue.trim()) {
      // Check if key already exists
      const existingIndex = items.findIndex(item => item.key === newKey.trim());
      if (existingIndex >= 0) {
        // Update existing key
        const newItems = [...items];
        newItems[existingIndex] = { key: newKey.trim(), value: newValue.trim() };
        onChange(newItems);
      } else {
        // Add new key-value pair
        onChange([...items, { key: newKey.trim(), value: newValue.trim() }]);
      }
      setNewKey("");
      setNewValue("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      {/* Existing items - display in rows of 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input 
              value={item.key}
              onChange={(e) => {
                const newItems = [...items];
                newItems[index] = { ...item, key: e.target.value };
                onChange(newItems);
              }}
              placeholder={keyPlaceholder}
              className="flex-1"
            />
            <Input 
              value={item.value}
              onChange={(e) => {
                const newItems = [...items];
                newItems[index] = { ...item, value: e.target.value };
                onChange(newItems);
              }}
              placeholder={valuePlaceholder}
              className="flex-1"
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleRemove(index)}
              className="h-10 w-10 text-gray-500 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      
      {/* Add new item */}
      <div className="flex items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={keyPlaceholder}
          className="flex-1"
        />
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={valuePlaceholder}
          className="flex-1"
        />
        <Button 
          onClick={handleAdd}
          disabled={!newKey.trim() || !newValue.trim()}
        >
          Add
        </Button>
      </div>

      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}