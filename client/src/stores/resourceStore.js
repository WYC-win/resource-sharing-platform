import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useResourceStore = defineStore('resource', () => {
  const categories = ref([])
  const loading = ref(false)

  function setCategories(list) {
    categories.value = list
  }

  return {
    categories,
    loading,
    setCategories,
  }
})
