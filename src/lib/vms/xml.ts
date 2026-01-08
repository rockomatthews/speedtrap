import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: false
});

export function parseXml<T = unknown>(xml: string): T {
  return parser.parse(xml) as T;
}

export function buildXml(rootName: string, value: unknown): string {
  return builder.build({ [rootName]: value });
}


