export interface WordDiff {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
}

export interface LineDiff {
  type: 'unchanged' | 'added' | 'removed';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  highlightedWords?: WordDiff[]; // For word-level highlighting within the line
}

/**
 * Splits text into words and whitespace tokens
 */
function tokenize(text: string): string[] {
  // Split on word boundaries but keep the delimiters
  return text.split(/(\s+|[^\w\s])/g).filter(token => token.length > 0);
}


/**
 * Creates highlighting for a specific line by comparing it to another line
 * Shows which words in the line are different from the comparison line
 */
function createSingleLineHighlighting(line: string, comparisonLine: string, highlightType: 'added' | 'removed'): WordDiff[] {
  const lineTokens = tokenize(line);
  const compTokens = tokenize(comparisonLine);
  
  return lineTokens.map(token => {
    // Skip highlighting for whitespace-only tokens
    if (/^\s*$/.test(token)) {
      return {
        type: 'unchanged' as const,
        content: token
      };
    }
    
    // If this token exists in the comparison line, it's unchanged
    if (compTokens.includes(token)) {
      return {
        type: 'unchanged' as const,
        content: token
      };
    } else {
      // This token is different - highlight it according to the type
      return {
        type: highlightType,
        content: token
      };
    }
  });
}

/**
 * Creates a line-based diff with word-level highlighting within added/removed lines
 */
export function createLineDiffWithWords(oldText: string, newText: string): LineDiff[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: LineDiff[] = [];
  
  let oldIndex = 0;
  let newIndex = 0;
  
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];
    
    if (oldIndex >= oldLines.length) {
      // Only new lines remaining - no highlighting since no comparison possible
      result.push({
        type: 'added',
        newLineNumber: newIndex + 1,
        content: newLine
      });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Only old lines remaining - no highlighting since no comparison possible
      result.push({
        type: 'removed',
        oldLineNumber: oldIndex + 1,
        content: oldLine
      });
      oldIndex++;
    } else if (oldLine === newLine) {
      // Lines match exactly
      result.push({
        type: 'unchanged',
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
        content: oldLine
      });
      oldIndex++;
      newIndex++;
    } else {
      // Lines differ - treat as a modification (removal + addition pair)
      // This ensures consistent - then + ordering for each edit
      const oldTokens = tokenize(oldLine);
      const newTokens = tokenize(newLine);
      const commonTokens = oldTokens.filter(token => newTokens.includes(token)).length;
      const similarity = commonTokens / Math.max(oldTokens.length, newTokens.length);
      
      if (similarity > 0.3) {
        // Lines are similar enough - create word-level highlighting
        // For removed line: highlight words that don't exist in the new line
        const removedHighlighting = createSingleLineHighlighting(oldLine, newLine, 'removed');
        // For added line: highlight words that don't exist in the old line
        const addedHighlighting = createSingleLineHighlighting(newLine, oldLine, 'added');
        
        result.push({
          type: 'removed',
          oldLineNumber: oldIndex + 1,
          content: oldLine,
          highlightedWords: removedHighlighting
        });
        result.push({
          type: 'added',
          newLineNumber: newIndex + 1,
          content: newLine,
          highlightedWords: addedHighlighting
        });
      } else {
        // Lines are too different - treat as separate removal and addition
        result.push({
          type: 'removed',
          oldLineNumber: oldIndex + 1,
          content: oldLine
        });
        result.push({
          type: 'added',
          newLineNumber: newIndex + 1,
          content: newLine
        });
      }
      oldIndex++;
      newIndex++;
    }
  }
  
  return result;
}