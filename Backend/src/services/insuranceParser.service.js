import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * Clean running headers, footers, page artifacts, and formatting noise
 * common in Insurance Policy PDFs, Endorsements, and Schedules.
 */
export const cleanInsuranceDocumentText = (rawText) => {
  if (!rawText) return '';

  let cleaned = rawText
    // Remove publication dates & insurer URL lines
    .replace(/www\.[a-z0-9\-]+\.(com|co\.uk|org|net)[^\n]*/gi, '')
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, '')
    // Remove running page numbers and footers (e.g., "-- 1 of 86 --", "Page 1 of 86", "1 of 86")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '')
    .replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, '')
    .replace(/^\s*\d+\s+of\s+\d+\s*$/gm, '')
    // Remove isolated dots or page break marker lines (e.g., .\n.\n.)
    .replace(/^\s*\.\s*$/gm, '')
    // Join hyphenated words split across lines (e.g., acci-\ndental -> accidental)
    .replace(/(\w+)-\n(\w+)/g, '$1$2')
    // Normalize newlines and whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
};

/**
 * Map insurance clause type to descriptive label
 */
export const getClauseTypeLabel = (text = '', title = '') => {
  const lower = `${text} ${title}`.toLowerCase();
  if (lower.includes('exclusion') || lower.includes('what is not covered') || lower.includes('not insured')) {
    return 'Exclusion Clause';
  }
  if (lower.includes('excess') || lower.includes('deductible') || lower.includes('compulsory excess') || lower.includes('voluntary excess')) {
    return 'Excess / Deductible Clause';
  }
  if (lower.includes('first notice of loss') || lower.includes('fnol') || lower.includes('claims procedure') || lower.includes('how to claim')) {
    return 'FNOL & Claims Procedure';
  }
  if (lower.includes('schedule') || lower.includes('coverage limit') || lower.includes('sum insured')) {
    return 'Coverage Schedule';
  }
  if (lower.includes('condition') || lower.includes('duty of care') || lower.includes('general condition')) {
    return 'Policy Condition';
  }
  if (lower.includes('endorsement') || lower.includes('amendment') || lower.includes('rider')) {
    return 'Policy Endorsement';
  }
  return 'Coverage Term';
};

/**
 * Advanced Insurance Policy Structure & Table Aware Chunking
 * Modeled on senior engineer's structure-aware parsing:
 * 1. Identifies Section boundaries (Section 1, Section 2, Part A, Part B, Schedules)
 * 2. Identifies Clause Codes (e.g. SEC 1.1, CLAUSE 2(a), EXC-3)
 * 3. Categorizes clauses: Coverage, Exclusion, Excess/Deductible, Condition, FNOL
 * 4. Context-injected headers prepended to every single chunk for precise RAG citation
 * 5. Subdivides long clauses by numbered points (1), (2), (a), (b) with max size 1200 chars
 * 6. Coalesces smaller adjacent blocks so chunks don't become tiny fragments
 */
export const splitInsurancePolicyIntoSemanticChunks = (rawText, docMetadata = {}) => {
  const text = cleanInsuranceDocumentText(rawText);
  if (!text) return [];

  const chunks = [];
  const { title = 'Insurance Policy Wording', policyType = 'AUTO', policyCode = '' } = docMetadata;

  // Regex to detect primary Section / Part / Schedule / Plan / Sheet boundaries
  // Matches "SECTION 1", "Plan 1 — Harbor", "PART A", "SCHEDULE 2", "SHEET: Plans"
  const sectionSplitRegex = /(?=(?:^|\n)\s*(?:SECTION|PART|SCHEDULE|EXCLUSIONS?|CONDITIONS?|ENDORSEMENTS?|CLAUSE|ARTICLE|PLAN|SHEET)\s*[:0-9A-Z\-—]+[^\n]*)/gi;
  const sections = text.split(sectionSplitRegex);

  // Fallback: If no explicit section headers found, use recursive paragraph chunking with context injection
  if (sections.length <= 1) {
    const rawBlocks = text.split(/\n\s*\n+/);
    const fallbackTexts = [];
    let cur = '';

    for (const b of rawBlocks) {
      if ((cur + '\n\n' + b).length > 1000) {
        if (cur) fallbackTexts.push(cur.trim());
        cur = b;
      } else {
        cur = cur ? cur + '\n\n' + b : b;
      }
    }
    if (cur.trim()) fallbackTexts.push(cur.trim());
    if (fallbackTexts.length === 0 && text.trim()) fallbackTexts.push(text.trim());

    return fallbackTexts.map((content, idx) => {
      const clauseType = getClauseTypeLabel(content);
      return {
        chunkIndex: idx,
        content: `[DOCUMENT: ${title}]\n[POLICY CODE: ${policyCode || 'POL-DEFAULT'}]\n[TYPE: ${policyType}]\n[SECTION: General Provisions (${clauseType})]\n\n${content}`,
        clauseCode: policyCode || `POL-${idx + 1}`,
        sectionTitle: 'General Provisions',
        clauseType,
        isExclusion: clauseType === 'Exclusion Clause',
        isSchedule: clauseType === 'Coverage Schedule',
        isExcess: clauseType === 'Excess / Deductible Clause',
        isFnolRule: clauseType === 'FNOL & Claims Procedure'
      };
    });
  }

  let globalChunkIndex = 0;
  const MAX_CHUNK_SIZE = 1200;

  for (const sectionBlock of sections) {
    if (!sectionBlock.trim()) continue;

    // Extract section header line
    const sectionLines = sectionBlock.trim().split('\n');
    const headerLine = sectionLines[0].trim().slice(0, 120);
    const sectionTitle = headerLine || 'Policy Terms';

    const isExclusion = /exclusion/i.test(sectionTitle) || /what is not covered/i.test(sectionTitle);
    const isSchedule = /schedule/i.test(sectionTitle);
    const isExcess = /excess|deductible/i.test(sectionTitle);
    const isFnolRule = /fnol|notice of loss|claim procedure|claims guide/i.test(sectionTitle);

    // Detect internal clause boundaries within section (e.g. "1.", "2.", "(a)", "(b)", "Clause 1.1")
    const clauseBoundaryRegex = /(?=(?:^|\n)\s*(?:(?:SECTION|CLAUSE|PART|ARTICLE)\s+[0-9]+[A-Z0-9\.\-]*|\([0-9a-z]\)|[0-9]+\.\s+[A-Z]))/gi;
    const clauseBlocks = sectionBlock.split(clauseBoundaryRegex);

    let pendingBlockContent = '';
    let pendingClauseCode = '';
    let pendingClauseType = '';

    const flushPending = () => {
      if (!pendingBlockContent.trim()) return;

      const effectiveType = pendingClauseType || getClauseTypeLabel(pendingBlockContent, sectionTitle);
      const contextPrefix = `[DOCUMENT: ${title}]
[POLICY CODE: ${policyCode || 'POL-REF'}]
[SECTION: ${sectionTitle}]
[CLAUSE: ${pendingClauseCode || policyCode || 'Term'} (${effectiveType})]
`;
      chunks.push({
        chunkIndex: globalChunkIndex++,
        content: `${contextPrefix}\n${pendingBlockContent.trim()}`,
        clauseCode: pendingClauseCode || policyCode || '',
        sectionTitle,
        clauseType: effectiveType,
        isExclusion: isExclusion || effectiveType === 'Exclusion Clause',
        isSchedule: isSchedule || effectiveType === 'Coverage Schedule',
        isExcess: isExcess || effectiveType === 'Excess / Deductible Clause',
        isFnolRule: isFnolRule || effectiveType === 'FNOL & Claims Procedure'
      });

      pendingBlockContent = '';
      pendingClauseCode = '';
      pendingClauseType = '';
    };

    for (const block of clauseBlocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock || trimmedBlock.length < 25) continue;

      // Extract clause code (e.g. "Clause 1.2" or "Section 2" or "1.")
      const codeMatch = trimmedBlock.match(/\b(?:(?:SECTION|CLAUSE|PART|ARTICLE)\s+([0-9]+[A-Z0-9\.\-]*)|([0-9]+\.[0-9]*))\b/i);
      const clauseCode = codeMatch ? codeMatch[0].trim() : (policyCode || 'Clause');
      const clauseType = getClauseTypeLabel(trimmedBlock, sectionTitle);

      if (trimmedBlock.length > MAX_CHUNK_SIZE) {
        flushPending();

        // Subdivide long clauses by sub-points: (1), (2), (a), (b)
        const subParts = trimmedBlock.split(/(?=\n\s*(?:\([0-9]+\)|\([a-z]\)|[0-9]+\.\s))/g);
        let currentSubChunk = '';

        for (const part of subParts) {
          if ((currentSubChunk + part).length > MAX_CHUNK_SIZE && currentSubChunk.length > 0) {
            const effectiveType = getClauseTypeLabel(currentSubChunk, sectionTitle);
            const contextPrefix = `[DOCUMENT: ${title}]
[POLICY CODE: ${policyCode || 'POL-REF'}]
[SECTION: ${sectionTitle}]
[CLAUSE: ${clauseCode} (${effectiveType})]
`;
            chunks.push({
              chunkIndex: globalChunkIndex++,
              content: `${contextPrefix}\n${currentSubChunk.trim()}`,
              clauseCode,
              sectionTitle,
              clauseType: effectiveType,
              isExclusion: isExclusion || effectiveType === 'Exclusion Clause',
              isSchedule: isSchedule || effectiveType === 'Coverage Schedule',
              isExcess: isExcess || effectiveType === 'Excess / Deductible Clause',
              isFnolRule: isFnolRule || effectiveType === 'FNOL & Claims Procedure'
            });
            currentSubChunk = part;
          } else {
            currentSubChunk += (currentSubChunk ? '\n' : '') + part;
          }
        }

        if (currentSubChunk.trim()) {
          const effectiveType = getClauseTypeLabel(currentSubChunk, sectionTitle);
          const contextPrefix = `[DOCUMENT: ${title}]
[POLICY CODE: ${policyCode || 'POL-REF'}]
[SECTION: ${sectionTitle}]
[CLAUSE: ${clauseCode} (${effectiveType})]
`;
          chunks.push({
            chunkIndex: globalChunkIndex++,
            content: `${contextPrefix}\n${currentSubChunk.trim()}`,
            clauseCode,
            sectionTitle,
            clauseType: effectiveType,
            isExclusion: isExclusion || effectiveType === 'Exclusion Clause',
            isSchedule: isSchedule || effectiveType === 'Coverage Schedule',
            isExcess: isExcess || effectiveType === 'Excess / Deductible Clause',
            isFnolRule: isFnolRule || effectiveType === 'FNOL & Claims Procedure'
          });
        }
      } else {
        // Coalesce smaller adjacent blocks in the same section
        if (pendingBlockContent.length + trimmedBlock.length > MAX_CHUNK_SIZE && pendingBlockContent.length > 0) {
          flushPending();
        }

        if (!pendingClauseCode) {
          pendingClauseCode = clauseCode;
          pendingClauseType = clauseType;
        } else if (clauseCode && !pendingClauseCode.includes(clauseCode)) {
          pendingClauseCode += `, ${clauseCode}`;
        }
        pendingBlockContent += (pendingBlockContent ? '\n\n' : '') + trimmedBlock;
      }
    }

    flushPending();
  }

  return chunks;
};
