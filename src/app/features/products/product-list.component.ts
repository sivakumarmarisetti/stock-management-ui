import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { ProductResponse } from '../../shared/models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {

  products: ProductResponse[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  currentPage = 0;
  pageSize = 5;
  totalPages = 0;
  totalElements = 0;
  searchKeyword = '';
  isSearching = false;
  showFilterPanel = false;
  filterProductName = '';
  filterProductType = '';
  filterMinRate: number | null = null;
  filterMaxRate: number | null = null;
  isFiltering = false;
  sortBy = 'id';
  sortDirection = 'asc';
  productToDelete: ProductResponse | null = null;
  canCreate = false;
  canEdit = false;
  canDelete = false;
  isExporting = false;
  canExport = false;
  showLowStockOnly = false;

  constructor(
    private productService: ProductService,
    private authService: AuthService,
    private exportService: ExportService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const role = this.authService.getUserRole();
    this.canCreate = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role || '');
    this.canEdit   = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role || '');
    this.canDelete = ['SUPER_ADMIN', 'ADMIN'].includes(role || '');
    this.canExport = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'INVENTORY_OPERATOR'].includes(role || '');

    this.route.queryParams.subscribe(params => {
      this.showLowStockOnly = params['filter'] === 'lowStock';
      this.loadProducts();
    });
  }

  loadProducts(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.isSearching = false;
    this.isFiltering = false;

    this.productService.getAllProducts(this.currentPage, this.pageSize, this.sortBy, this.sortDirection).subscribe({
      next: (res) => {
        this.products = this.showLowStockOnly
          ? res.data.content.filter((p: ProductResponse) => p.quantity <= 10)
          : res.data.content;
        this.totalPages = res.data.totalPages;
        this.totalElements = res.data.totalElements;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load products';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(): void {

  const keyword = this.searchKeyword.trim();

  if (!keyword) {
    this.currentPage = 0;
    this.loadProducts();
    return;
  }

  if (keyword.length < 2) {
    return;
  }

  this.isLoading = true;
  this.isSearching = true;
  this.isFiltering = false;
  this.currentPage = 0;

  this.productService
      .searchProducts(keyword, this.currentPage, this.pageSize)
      .subscribe({
        next: (res) => {
          this.products = res.data.content;
          this.totalPages = res.data.totalPages;
          this.totalElements = res.data.totalElements;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Search failed';
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
}

  clearSearch(): void {
    this.searchKeyword = '';
    this.currentPage = 0;
    this.loadProducts();
  }

  applyFilter(): void {
    this.isLoading = true;
    this.isFiltering = true;
    this.isSearching = false;
    this.currentPage = 0;
    this.productService.filterProducts(
      {
        productName: this.filterProductName || undefined,
        productType: this.filterProductType || undefined,
        minRate: this.filterMinRate ?? undefined,
        maxRate: this.filterMaxRate ?? undefined
      },
      this.currentPage,
      this.pageSize
    ).subscribe({
      next: (res) => {
        this.products = res.data.content;
        this.totalPages = res.data.totalPages;
        this.totalElements = res.data.totalElements;
        this.isLoading = false;
        this.showFilterPanel = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Filter failed';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  clearFilter(): void {
    this.filterProductName = '';
    this.filterProductType = '';
    this.filterMinRate = null;
    this.filterMaxRate = null;
    this.isFiltering = false;
    this.currentPage = 0;
    this.loadProducts();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    if (this.isSearching) this.onSearch();
    else if (this.isFiltering) this.applyFilter();
    else this.loadProducts();
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.currentPage = 0;
    this.loadProducts();
  }

  confirmDelete(product: ProductResponse): void {
    this.productToDelete = product;
  }

  executeDelete(): void {
    if (!this.productToDelete) return;
    this.productService.deleteProduct(this.productToDelete.id).subscribe({
      next: () => {
        this.successMessage = 'Product deleted successfully';
        this.productToDelete = null;
        this.loadProducts();
        setTimeout(() => {
          this.successMessage = '';
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Delete failed';
        this.productToDelete = null;
        this.cdr.detectChanges();
      }
    });
  }

  cancelDelete(): void {
    this.productToDelete = null;
  }

  exportToCsv(): void {
    this.isExporting = true;
    this.exportService.exportProducts().subscribe({
      next: (csvData) => {
        this.exportService.downloadCsv(csvData, 'products.csv');
        this.isExporting = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Export failed. Please try again.';
        this.isExporting = false;
        this.cdr.detectChanges();
      }
    });
  }
}