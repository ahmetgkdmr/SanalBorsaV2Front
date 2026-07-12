import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IndexQuote } from '../models/index.model';

@Injectable({ providedIn: 'root' })
export class IndexApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/indices`;

  getQuotes(): Observable<IndexQuote[]> {
    return this.http.get<IndexQuote[]>(this.base);
  }
}
