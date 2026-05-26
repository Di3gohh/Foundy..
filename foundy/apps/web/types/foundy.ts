export type ItemCategory = 'documentos' | 'eletronicos' | 'chaves' | 'vestuario' | 'outros'
export type ItemCategoryFilter = ItemCategory | 'todos'

export type FoundyItem = {
  id: string
  title: string
  description: string
  category: ItemCategory
  latitude: number
  longitude: number
  locationLabel: string
  locationRadiusMeters: number
  isPremium: boolean
}
